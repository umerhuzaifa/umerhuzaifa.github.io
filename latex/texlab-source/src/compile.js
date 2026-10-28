// Drives the WebAssembly pdfTeX engine (SwiftLaTeX) from the page.
//
// TeX Live files (packages, fonts, ...) are requested by the engine over
// synchronous XHR. sw.js answers those requests from the bundled subset, a
// TeX Live mirror, and a persistent cache.

import { prepareBibliography } from './bib.js';
import { parseLog, needsRerun } from './logparse.js';

class EngineCrash extends Error {}
let engine = null;
let crash = null;
let loading = null;
let onDemand = false;
let fallbackLoaded = false;

const createdDirs = new Set();
const written = new Map(); // path -> string | ArrayBuffer last written to MEMFS
let lastWorkDir = null;
let lastProject = null;

const BASE = new URL('./', document.baseURI).href;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-engine="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.dataset.engine = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });
}

// The engine worker inherits the page's service worker when it is created,
// so the page must be controlled before the worker is spawned.
async function serviceWorkerActive(timeoutMs = 5000) {
  if (!('serviceWorker' in navigator)) return false;
  if (navigator.serviceWorker.controller) return true;
  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((r) => setTimeout(() => r(null), timeoutMs)),
    ]);
    if (!reg) return false;
    if (navigator.serviceWorker.controller) return true;
    reg.active?.postMessage({ type: 'claim' });
    await Promise.race([
      new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', () => r(), { once: true })),
      new Promise((r) => setTimeout(r, timeoutMs)),
    ]);
    return !!navigator.serviceWorker.controller;
  } catch {
    return false;
  }
}

async function readList(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    return (await r.text()).split('\n').map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// Fallback for browsers/contexts without a service worker: copy the whole
// bundled subset into the engine's memory file system before compiling.
async function preloadFallback(eng, onProgress) {
  if (fallbackLoaded) return;
  const [text, bin] = await Promise.all([
    readList(BASE + 'texlive/cache-manifest-text.txt'),
    readList(BASE + 'texlive/cache-manifest-binary.txt'),
  ]);
  const jobs = [
    ...text.map((name) => async () => {
      const r = await fetch(BASE + 'texlive/cache/' + encodeURIComponent(name));
      if (r.ok) eng.writeMemFSFile('/tex/' + name, await r.text());
    }),
    ...bin.map((name) => async () => {
      const r = await fetch(BASE + 'texlive/cache/' + encodeURIComponent(name));
      if (r.ok) eng.writeBinaryMemFSFile('/tex/' + name, await r.arrayBuffer());
    }),
  ];
  for (let i = 0; i < jobs.length; i += 40) {
    await Promise.allSettled(jobs.slice(i, i + 40).map((j) => j()));
    onProgress?.(Math.min(1, (i + 40) / jobs.length));
  }
  fallbackLoaded = true;
}

async function initEngine() {
  onDemand = await serviceWorkerActive();
  await loadScript(BASE + 'swiftlatex/PdfTeXEngine.js');
  const Eng = globalThis.PdfTeXEngine;
  if (!Eng) throw new Error('PdfTeXEngine failed to load');
  engine = new Eng();
  await engine.loadEngine();
  engine.setTexliveEndpoint(BASE + 'texlive/');
  // an uncaught exception inside the worker (e.g. a damaged PNG) never answers
  // the pending compile, so turn it into a rejection
  const worker = engine.latexWorker;
  crash = new Promise((_, reject) => {
    worker.addEventListener('error', (e) => reject(new EngineCrash(e.message || 'engine crashed')));
  });
  crash.catch(() => {});
  createdDirs.clear();
  written.clear();
  lastWorkDir = null;
  lastProject = null;
  fallbackLoaded = false;
}

function killEngine() {
  try { engine?.latexWorker?.terminate(); } catch {}
  engine = null;
  loading = null;
  crash = null;
}

async function runPass(eng) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new EngineCrash('the engine did not answer in time')), 5 * 60 * 1000);
  });
  try {
    const res = await Promise.race([eng.compileLaTeX(), crash, timeout]);
    if (res.status === -254) killEngine(); // an aborted wasm instance cannot be reused; the next compile starts a fresh one
    return res;
  } catch (e) {
    if (e instanceof EngineCrash) killEngine();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function getEngine() {
  if (engine?.isReady()) return engine;
  if (!loading) {
    loading = initEngine().finally(() => { loading = null; });
  }
  await loading;
  if (!engine?.isReady()) throw new Error('The LaTeX engine failed to start.');
  return engine;
}

export function warmup() {
  return getEngine().catch(() => {});
}

function flush(eng) {
  eng.flushCache();
  createdDirs.clear();
  written.clear();
}

/** Forget everything in the engine's work directory (aux files, cached copies). */
export function clean() {
  if (engine?.isReady()) flush(engine);
  lastWorkDir = null;
  lastProject = null;
}

const dirOf = (p) => { const s = p.lastIndexOf('/'); return s === -1 ? '' : p.slice(0, s + 1); };

/**
 * @param {string} main        project-relative path of the main .tex file
 * @param {Map<string,string>} texts   text files
 * @param {Map<string,ArrayBuffer>} bins   binary files
 * @returns {Promise<{pdf?:Uint8Array,status:number,log:string,issues:object[],ms:number}>}
 */
export async function compile(main, texts, bins, opts = {}) {
  try {
    return await compileOnce(main, texts, bins, opts);
  } catch (e) {
    if (!(e instanceof EngineCrash)) throw e;
    opts.onStage?.('The engine crashed, restarting…');
    try {
      return await compileOnce(main, texts, bins, opts);
    } catch (e2) {
      if (!(e2 instanceof EngineCrash)) throw e2;
      throw new Error('The LaTeX engine crashed while compiling this project. A damaged image or font file is the usual cause: check the files you uploaded.');
    }
  }
}

async function compileOnce(main, texts, bins, { onStage, projectId = null } = {}) {
  const t0 = performance.now();
  onStage?.('Starting engine…');
  const eng = await getEngine();
  if (!onDemand) {
    onStage?.('Loading TeX packages…');
    await preloadFallback(eng, (f) => onStage?.(`Loading TeX packages… ${Math.round(f * 100)}%`));
  }

  onStage?.('Preparing files…');
  const prep = prepareBibliography(texts, main);
  const notes = prep.notes;
  const dir = dirOf(main);

  // everything under the main file's folder, paths made relative to it
  const view = new Map();
  for (const [p, c] of prep.files) if (p.startsWith(dir)) view.set(p.slice(dir.length), c);
  for (const [p, c] of bins) if (p.startsWith(dir)) view.set(p.slice(dir.length), c);
  const mainRel = main.slice(dir.length);

  // a different folder or a removed file: start from a clean work directory
  // another project reuses names like main.aux, so nothing may carry over
  let stale = (lastWorkDir !== null && lastWorkDir !== dir) || lastProject !== projectId;
  lastProject = projectId;
  for (const p of written.keys()) if (!view.has(p) && !/\.(aux|toc|out|lof|lot|log|pdf|bbl|blg|nav|snm|vrb|fls)$/i.test(p)) stale = true;
  if (stale) flush(eng);
  lastWorkDir = dir;

  for (const p of view.keys()) {
    const parts = p.split('/');
    for (let i = 1; i < parts.length; i++) {
      const d = parts.slice(0, i).join('/');
      if (!createdDirs.has(d)) { eng.makeMemFSFolder(d); createdDirs.add(d); }
    }
  }
  for (const [p, c] of view) {
    if (written.get(p) === c) continue;
    if (typeof c === 'string') eng.writeMemFSFile(p, c);
    else eng.writeBinaryMemFSFile(p, c);
    written.set(p, c);
  }

  eng.setEngineMainFile(mainRel);

  // The engine runs a real BibTeX after every pass. When it cannot find the
  // .bst style (offline, unusual style) it leaves an empty .bbl behind, so we
  // put our own formatted bibliography back before the next pass.
  const bblRel = prep.bbl ? prep.bbl.path.slice(dir.length) : null;
  const BIBTEX_FAIL = /couldn't open style file|found no style file|couldn't open database file/;
  let res, log = '', pass = 0, usedFallback = false;
  const run = async () => {
    pass++;
    onStage?.(pass === 1 ? 'Compiling…' : `Compiling (pass ${pass})…`);
    res = await runPass(eng);
    log = res.log || '';
    console.log('[texlab] pass', pass, 'status', res.status, 'pdf', res.pdf?.length || 0);
    if (res.status === 0 && bblRel && BIBTEX_FAIL.test(log)) {
      eng.writeMemFSFile(bblRel, prep.bbl.text);
      written.set(bblRel, prep.bbl.text);
      usedFallback = true;
    }
  };
  await run();

  // More passes only while the log asks for them. Plain "undefined reference"
  // warnings justify one extra pass; after that only an explicit request to
  // rerun does, so a typo'd \ref never makes every compile slow.
  const again = () =>
    res.status === 0 && pass < 3 && (pass === 1 ? needsRerun(log) : /Rerun to get|Label\(s\) may have changed|Please rerun/.test(log));
  while (again()) await run();

  if (usedFallback) {
    notes.push({ level: 'info', msg: 'The BibTeX style for this document is not available offline, so the bibliography was formatted by TeXLab (plain/alpha/unsrt look).' });
  }

  if (res.status !== 0) flush(eng); // a failed run can leave broken aux files behind

  const issues = [
    ...notes.map((n) => ({ level: n.level, msg: n.msg, file: null, line: null, context: '', source: 'TeXLab' })),
    ...parseLog(log, { mainFile: main, workDir: dir }).map((i) => ({ ...i, file: i.file ? dir + i.file : i.file })),
  ];
  if (res.status === -254 && !issues.some((i) => i.level === 'error')) {
    issues.push({
      level: 'error',
      msg: 'The LaTeX engine stopped unexpectedly.',
      file: null,
      line: null,
      context: '',
      hint: 'This is usually caused by a damaged or unsupported image or font file. Re-export the image (PNG, JPG or PDF) and upload it again.',
    });
  }
  return { pdf: res.pdf, status: res.status, log, issues, ms: performance.now() - t0 };
}
