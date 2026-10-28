/* TeXLab service worker
 *
 * 1. Answers the LaTeX engine's requests for TeX Live files
 *    (<base>/texlive/pdftex/<format>/<name>) from, in order:
 *      a. files fetched earlier (persistent cache)
 *      b. the subset bundled next to the app (<base>/texlive/cache/)
 *      c. a TeX Live 2020 texmf-dist mirror on jsDelivr
 *      d. a SwiftLaTeX-compatible TeX Live server
 * 2. Keeps the app itself available offline (network first, cache fallback).
 *
 * Adapted from the service worker of TeXbrain (MIT), https://github.com/swimmingbrain/texbrain
 */

const BUILD = '__BUILD__';
const BASE = new URL('./', self.location).pathname; // e.g. /latex/
const TEXLIVE_PREFIX = BASE + 'texlive/pdftex/';
const APP_CACHE = 'texlab-app-' + BUILD;
const TEXLIVE_CACHE = 'texlab-texlive-v1';

const STATIC_MIRROR = 'https://cdn.jsdelivr.net/gh/SachaNevsky/latexdiff-texmf-dist@aca46fc00975feebf98e038976790805c3e932df';
const LSR_URL = STATIC_MIRROR + '/ls-R';
const FALLBACK_SERVER = 'https://texlive.texlyre.org/';

// ---- kpathsea-style name candidates ---------------------------------------
const FORMAT_EXT = {
  3: ['.tfm'], 4: ['.afm'], 6: ['.bib'], 7: ['.bst'], 10: ['.fmt'], 11: ['.map'], 20: ['.ofm'],
  23: ['.ovf'], 25: ['.eps', '.epsi'], 26: ['.tex'], 30: ['.pro'], 32: ['.pfb', '.pfa'], 33: ['.vf'],
  36: ['.ttf'], 44: ['.enc'], 45: ['.cmap'], 46: ['.sfd'], 47: ['.otf'], 48: ['.cfg'],
};
const ANY_EXT = ['', '.tfm', '.pfb', '.vf', '.sty', '.cls', '.fd', '.def', '.cfg', '.clo', '.tex', '.ltx', '.map', '.enc', '.dfu', '.ldf'];

function candidateNames(name, format) {
  const exts = FORMAT_EXT[Number(format)];
  if (!exts) return ANY_EXT.map((e) => name + e);
  const withExt = exts.map((e) => name + e);
  return /\.[^./]+$/.test(name) ? [name, ...withExt] : [...withExt, name];
}

// ---- helpers -----------------------------------------------------------------
async function openCache(name) {
  try { return await caches.open(name); } catch { return null; }
}

function looksLikeHtml(buf) {
  const head = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(100, buf.byteLength))).toLowerCase();
  return head.includes('<!doctype') || head.includes('<html');
}

function looksValid(buf, name, isPk) {
  if (buf.byteLength === 0 || looksLikeHtml(buf)) return false;
  const b = new Uint8Array(buf);
  if (isPk) return b.length > 2 && b[0] === 0xf7 && b[1] === 0x59;
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  if (ext === '.tfm') { const w = (b[0] << 8) | b[1]; return w > 6 && w * 4 <= b.length; }
  if (ext === '.vf') return b.length > 2 && b[0] === 0xf7 && b[1] === 0xca;
  if (ext === '.pfb') return b.length > 2 && b[0] === 0x80 && b[1] === 0x01;
  return true;
}

function timed(url, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { signal: c.signal }).finally(() => clearTimeout(t));
}

let manifestP = null;
function loadManifest() {
  if (manifestP) return manifestP;
  manifestP = (async () => {
    const names = new Set();
    for (const f of ['texlive/cache-manifest-text.txt', 'texlive/cache-manifest-binary.txt']) {
      try {
        const r = await fetch(BASE + f);
        if (!r.ok) continue;
        for (const l of (await r.text()).split('\n')) if (l.trim()) names.add(l.trim());
      } catch {}
    }
    if (!names.size) manifestP = null;
    return names;
  })();
  return manifestP;
}

let lsrP = null;
function loadLsr() {
  if (lsrP) return lsrP;
  lsrP = (async () => {
    const map = new Map();
    try {
      const cache = await openCache(TEXLIVE_CACHE);
      let r = cache ? await cache.match(LSR_URL) : undefined;
      if (!r) {
        r = await timed(LSR_URL, 60000);
        if (r.ok && cache) await cache.put(LSR_URL, r.clone());
      }
      if (!r.ok) throw new Error('ls-R unavailable');
      let dir = null;
      for (const raw of (await r.text()).split('\n')) {
        const line = raw.trim();
        if (!line || line.startsWith('%')) continue;
        if (line.endsWith(':')) {
          dir = line.slice(0, -1).replace(/^\.\/?/, '');
          if (dir.startsWith('doc') || dir.startsWith('source')) dir = null;
          continue;
        }
        if (dir && !map.has(line)) map.set(line, dir);
      }
    } catch { lsrP = null; }
    return map;
  })();
  return lsrP;
}

function answer(buf, id, isPk) {
  const headers = {
    'Content-Type': 'application/octet-stream',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=86400',
  };
  headers[isPk ? 'pkid' : 'fileid'] = id;
  return new Response(buf, { status: 200, headers });
}

async function handleTexlive(request, url) {
  const cache = await openCache(TEXLIVE_CACHE);
  const isPk = url.pathname.includes('/pdftex/pk/');
  const parts = url.pathname.split('/');
  const name = decodeURIComponent(parts.pop() || '');
  const format = isPk ? '' : parts.pop() || '';

  const hit = cache ? await cache.match(request) : undefined;
  if (hit) {
    const id = hit.headers.get(isPk ? 'pkid' : 'fileid') || name;
    if ((isPk || candidateNames(name, format).includes(id)) && looksValid(await hit.clone().arrayBuffer(), id, isPk)) return hit;
    await cache.delete(request);
  }
  const remember = async (resp) => {
    if (cache) { try { await cache.put(request, resp.clone()); } catch {} }
    return resp;
  };

  // the precompiled format file is a real static asset
  if (name.endsWith('.fmt')) {
    try {
      const r = await fetch(request);
      if (r.ok) {
        const buf = await r.arrayBuffer();
        if (!looksLikeHtml(buf)) return remember(answer(buf, name, false));
      }
    } catch {}
  }

  // a. bundled subset
  if (!isPk) {
    const names = await loadManifest();
    const resolved = candidateNames(name, format).find((c) => names.has(c));
    if (resolved) {
      try {
        const r = await fetch(`${BASE}texlive/cache/${encodeURIComponent(resolved)}`);
        if (r.ok) {
          const buf = await r.arrayBuffer();
          if (looksValid(buf, resolved, false)) return answer(buf, resolved, false); // static files: the HTTP cache handles repeats
        }
      } catch {}
    }
  }

  // b. jsDelivr texmf-dist mirror
  if (!isPk) {
    const map = await loadLsr();
    for (const cand of candidateNames(name, format)) {
      const dir = map.get(cand);
      if (!dir) continue;
      try {
        const r = await timed(encodeURI(`${STATIC_MIRROR}/${dir}/${cand}`), 30000);
        if (r.ok) {
          const buf = await r.arrayBuffer();
          if (looksValid(buf, cand, false)) return remember(answer(buf, cand, false));
        }
      } catch {}
      break;
    }
  }

  // c. SwiftLaTeX-compatible server (also builds pk bitmap fonts)
  try {
    const remote = FALLBACK_SERVER.replace(/\/$/, '') + url.pathname.slice(BASE.length - 1 + '/texlive'.length);
    const r = await timed(remote, 30000);
    if (r.ok) {
      const buf = await r.arrayBuffer();
      const id = r.headers.get(isPk ? 'pkid' : 'fileid') || name;
      if (looksValid(buf, id, isPk)) return remember(answer(buf, id, isPk));
    }
  } catch {}

  return new Response('', { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
}

async function networkFirst(request) {
  const cache = await openCache(APP_CACHE);
  try {
    const r = await fetch(request);
    if (r.status === 200 && cache) { try { await cache.put(request, r.clone()); } catch {} }
    return r;
  } catch (err) {
    const cached = (cache && (await cache.match(request, { ignoreSearch: true }))) || (await caches.match(request).catch(() => undefined));
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const page = cache && (await cache.match(BASE));
      if (page) return page;
    }
    throw err;
  }
}

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      for (const n of await caches.keys()) {
        if (n.startsWith('texlab-app-') && n !== APP_CACHE) await caches.delete(n);
      }
    } catch {}
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'claim') self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin && url.pathname.startsWith(TEXLIVE_PREFIX)) {
    event.respondWith(handleTexlive(req, url).catch(() => fetch(req)));
    return;
  }
  // the large bundled package files are only ever fetched by this worker
  if (url.origin === self.location.origin && url.pathname.startsWith(BASE + 'texlive/')) return;
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req).catch(() => fetch(req)));
  }
});
