// The in-browser engine has no BibTeX or Biber. This module covers the common
// cases by reading the .tex and .bib sources and producing the .bbl file that
// BibTeX would have written.
//
//  - \bibliography{refs} + \bibliographystyle{...}  ->  generates <job>.bbl
//  - biblatex (\addbibresource / \printbibliography) -> rewritten on the fly to
//    natbib with the bibliography inlined (your files are never modified)
//
// The output follows the "plain"/"alpha"/"unsrt" look; it is not a byte-exact
// copy of every .bst style, which is the trade-off for running without a server.

const MONTHS = {
  jan: 'January', feb: 'February', mar: 'March', apr: 'April', may: 'May', jun: 'June',
  jul: 'July', aug: 'August', sep: 'September', oct: 'October', nov: 'November', dec: 'December',
};

export function stripComments(src) {
  return src.replace(/(^|[^\\])%.*$/gm, '$1');
}

// ---------------------------------------------------------------- .bib parser

export function parseBib(text) {
  const entries = new Map();
  const strings = { ...MONTHS };
  let i = 0;
  const n = text.length;
  while (i < n) {
    const at = text.indexOf('@', i);
    if (at === -1) break;
    i = at + 1;
    const m = /^([A-Za-z]+)\s*([{(])/.exec(text.slice(i, i + 40));
    if (!m) continue;
    const type = m[1].toLowerCase();
    const close = m[2] === '{' ? '}' : ')';
    i += m[0].length;

    if (type === 'comment' || type === 'preamble') {
      i = skipBalanced(text, i, m[2], close);
      continue;
    }
    if (type === 'string') {
      const sm = /^\s*([A-Za-z_][\w-]*)\s*=\s*/.exec(text.slice(i));
      if (sm) {
        i += sm[0].length;
        const [val, next] = readValue(text, i, strings);
        strings[sm[1].toLowerCase()] = val;
        i = next;
      }
      i = skipBalanced(text, i, m[2], close);
      continue;
    }

    const km = /^\s*([^,\s]+)\s*,/.exec(text.slice(i));
    if (!km) continue;
    const key = km[1];
    i += km[0].length;
    const fields = {};
    while (i < n) {
      while (i < n && /[\s,]/.test(text[i])) i++;
      if (text[i] === close || i >= n) { i++; break; }
      const fm = /^([A-Za-z][\w-]*)\s*=\s*/.exec(text.slice(i, i + 80));
      if (!fm) { i++; continue; }
      i += fm[0].length;
      const [val, next] = readValue(text, i, strings);
      fields[fm[1].toLowerCase()] = val;
      i = next;
    }
    entries.set(key, { type, key, fields });
  }
  return entries;
}

function skipBalanced(text, i, open, close) {
  let depth = 1;
  while (i < text.length && depth > 0) {
    if (text[i] === open) depth++;
    else if (text[i] === close) depth--;
    i++;
  }
  return i;
}

// a value is one or more parts joined with '#': {braced}, "quoted", number, macro
function readValue(text, i, strings) {
  let out = '';
  for (;;) {
    while (/\s/.test(text[i] || '')) i++;
    const c = text[i];
    if (c === '{') {
      let depth = 1;
      const start = ++i;
      while (i < text.length && depth > 0) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') depth--;
        i++;
      }
      out += text.slice(start, i - 1);
    } else if (c === '"') {
      const start = ++i;
      let depth = 0;
      while (i < text.length && !(text[i] === '"' && depth === 0)) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') depth--;
        i++;
      }
      out += text.slice(start, i);
      i++;
    } else {
      const m = /^[\w.:-]+/.exec(text.slice(i, i + 60));
      if (!m) break;
      out += strings[m[0].toLowerCase()] ?? m[0];
      i += m[0].length;
    }
    while (/\s/.test(text[i] || '')) i++;
    if (text[i] === '#') { i++; continue; }
    break;
  }
  return [out.replace(/\s+/g, ' ').trim(), i];
}

// ------------------------------------------------------------------- names

function splitTop(s, sep) {
  const parts = [];
  let depth = 0, cur = '';
  const re = new RegExp('^' + sep.source, 'i');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    if (depth === 0) {
      const m = re.exec(s.slice(i));
      if (m && m[0].length) { parts.push(cur); cur = ''; i += m[0].length - 1; continue; }
    }
    cur += c;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function parseName(raw) {
  const commaParts = splitTop(raw, /,/);
  let first = '', last = '';
  if (commaParts.length >= 2) {
    last = commaParts[0];
    first = commaParts.slice(1).join(' ');
  } else {
    const words = splitTop(raw, /\s+/);
    if (words.length === 1) last = words[0];
    else {
      let k = words.length - 1;
      // "Ludwig van Beethoven": last name starts at the first lowercase word
      const lower = words.findIndex((w, idx) => idx > 0 && idx < words.length - 1 && /^[a-z]/.test(w));
      if (lower > 0) k = lower;
      last = words.slice(k).join(' ');
      first = words.slice(0, k).join(' ');
    }
  }
  return { first, last };
}

function initials(first) {
  return splitTop(first, /[\s]+/)
    .map((w) =>
      w
        .split('-')
        .map((p) => {
          const m = /^(\{[^}]*\}|\\.\{?[A-Za-z]\}?|\\.|.)/.exec(p);
          return m ? m[0] + '.' : '';
        })
        .join('-')
    )
    .join('~');
}

function authorsOf(e) {
  const raw = e.fields.author || e.fields.editor || '';
  return splitTop(raw, /\s+and\s+/).map(parseName);
}

const plainText = (s) => s.replace(/\\[a-zA-Z]+\s*/g, '').replace(/\\['`^"~=.]\{?(\w)\}?/g, '$1').replace(/[{}$\\]/g, '');

function joinNames(list) {
  if (list.length <= 1) return list[0] || '';
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
}

// ------------------------------------------------------------- formatting

const end = (s) => (/[.?!]$/.test(s.replace(/\}+$/, '')) ? s : s + '.');
const emph = (s) => `\\emph{${s}}`;

function formatEntry(e) {
  const f = e.fields;
  const names = authorsOf(e).map((a) => (a.first ? `${initials(a.first)}~${a.last}` : a.last));
  let who = joinNames(names);
  if (!f.author && f.editor) who += names.length > 1 ? ', editors' : ', editor';
  const title = f.title || '';
  const year = f.year || '';
  const date = [f.month ? MONTHS[f.month.toLowerCase().slice(0, 3)] || f.month : '', year].filter(Boolean).join(' ');
  const blocks = [];
  if (who) blocks.push(end(who));

  const volnum = f.volume ? `${f.volume}${f.number ? `(${f.number})` : ''}${f.pages ? ':' + f.pages : ''}` : f.pages ? `pages ${f.pages}` : '';

  switch (e.type) {
    case 'article':
      if (title) blocks.push(end(title));
      blocks.push(end([f.journal ? emph(f.journal) : '', volnum, date].filter(Boolean).join(', ')));
      break;
    case 'book':
    case 'proceedings':
    case 'booklet':
    case 'manual':
      if (title) blocks.push(end(emph(title)));
      blocks.push(
        end(
          [f.edition ? `${f.edition} edition` : '', f.series, f.publisher || f.organization || f.howpublished, f.address, date]
            .filter(Boolean)
            .join(', ')
        )
      );
      break;
    case 'inproceedings':
    case 'conference':
    case 'incollection':
    case 'inbook': {
      if (title) blocks.push(end(title));
      const where = ['In', f.booktitle ? emph(f.booktitle) : ''].filter(Boolean).join(' ');
      const pg = f.pages ? `pages ${f.pages}` : '';
      blocks.push(end([where, pg, f.address, f.publisher || f.organization, date].filter(Boolean).join(', ')));
      break;
    }
    case 'phdthesis':
    case 'mastersthesis':
      if (title) blocks.push(end(emph(title)));
      blocks.push(end([e.type === 'phdthesis' ? 'PhD thesis' : "Master's thesis", f.school, f.address, date].filter(Boolean).join(', ')));
      break;
    case 'techreport':
      if (title) blocks.push(end(title));
      blocks.push(end([`${f.type || 'Technical Report'}${f.number ? ' ' + f.number : ''}`, f.institution, f.address, date].filter(Boolean).join(', ')));
      break;
    default:
      if (title) blocks.push(end(title));
      {
        const tail = [f.howpublished, f.journal ? emph(f.journal) : '', f.publisher, date].filter(Boolean).join(', ');
        if (tail) blocks.push(end(tail));
      }
  }
  if (f.note) blocks.push(end(f.note));
  if (f.doi && !/\burl\b/i.test(f.note || '')) blocks.push(`doi:\\nolinkurl{${f.doi}}.`);
  return blocks.join('\n\\newblock ');
}

function alphaLabel(e) {
  const as = authorsOf(e);
  const yy = (e.fields.year || '').slice(-2);
  const clean = (s) => plainText(s).replace(/[^A-Za-z]/g, '');
  if (as.length === 0) return clean(e.key).slice(0, 3) + yy;
  if (as.length === 1) return clean(as[0].last).slice(0, 3) + yy;
  if (as.length <= 4) return as.map((a) => clean(a.last)[0] || '').join('') + yy;
  return as.slice(0, 3).map((a) => clean(a.last)[0] || '').join('') + '+' + yy;
}

function natbibLabel(e) {
  const as = authorsOf(e).map((a) => a.last);
  const year = e.fields.year || '';
  let short, long;
  if (as.length === 0) short = long = e.fields.title || e.key;
  else if (as.length === 1) short = long = as[0];
  else if (as.length === 2) { short = `${as[0]} and ${as[1]}`; long = short; }
  else { short = `${as[0]} et~al.`; long = joinNames(as); }
  return `{${short}(${year})${long}}`;
}

const UNSORTED = /^(unsrt|ieeetr|ieeetran|unsrtnat|ieeetran|IEEEtran|siam|acm|elsarticle-num|naturemag|vancouver)/i;
const ALPHA = /^alpha/i;

export function makeBibliography(keys, entries, { style = 'plain', natbib = false } = {}) {
  const notes = [];
  let list = [];
  const seen = new Set();
  const wantAll = keys.includes('*');
  if (wantAll) {
    for (const e of entries.values()) { list.push(e); seen.add(e.key); }
  }
  for (const k of keys) {
    if (k === '*' || seen.has(k)) continue;
    const e = entries.get(k) || [...entries.values()].find((x) => x.key.toLowerCase() === k.toLowerCase());
    if (!e) { notes.push({ level: 'warning', msg: `Citation “${k}” was not found in any .bib file.` }); continue; }
    seen.add(e.key);
    list.push(e);
  }
  if (!UNSORTED.test(style)) {
    const sortKey = (e) =>
      [authorsOf(e).map((a) => plainText(a.last)).join(' '), e.fields.year || '', plainText(e.fields.title || '')]
        .join('\u0001')
        .toLowerCase();
    list = list.slice().sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0));
  }
  if (list.length === 0) return { bbl: '', notes };

  const alpha = ALPHA.test(style) && !natbib;
  const labels = list.map((e) => (natbib ? natbibLabel(e) : alpha ? alphaLabel(e) : null));
  const widest = alpha
    ? labels.reduce((a, b) => (b.length > a.length ? b : a), '')
    : '9'.repeat(String(list.length).length);

  let bbl = `\\begin{thebibliography}{${widest}}\n\n`;
  list.forEach((e, i) => {
    const opt = labels[i] ? `[${labels[i]}]` : '';
    bbl += `\\bibitem${opt}{${e.key}}\n${formatEntry(e)}\n\n`;
  });
  bbl += '\\end{thebibliography}\n';
  return { bbl, notes };
}

// ------------------------------------------------------------ project level

const CITE_RE = /\\(?:[A-Za-z]*cite[A-Za-z]*|nocite)\*?(?:\s*\[[^\]]*\]){0,2}\s*\{([^}]*)\}/g;

function dirOf(p) { const s = p.lastIndexOf('/'); return s === -1 ? '' : p.slice(0, s + 1); }
const norm = (p) => p.replace(/^\.\//, '');

// follow \input / \include / \subfile so citations come out in document order
export function flatten(files, path, seen = new Set(), baseDir = '') {
  if (seen.has(path) || !files.has(path)) return '';
  seen.add(path);
  const src = stripComments(files.get(path))
    .replace(/\\begin\{(verbatim|lstlisting|minted)\*?\}[\s\S]*?\\end\{\1\*?\}/g, ' ')
    .replace(/\\verb\*?([^A-Za-z\s*])[^\n]*?\1/g, ' ');
  return src.replace(/\\(?:input|include|subfile)\s*\{([^}]+)\}/g, (m, name) => {
    const rel = norm(name.trim());
    for (const cand of [baseDir + rel, baseDir + rel + '.tex', rel, rel + '.tex']) {
      if (files.has(cand)) return '\n' + flatten(files, cand, seen, baseDir) + '\n';
    }
    return m;
  });
}

function allBibEntries(files, names, baseDir) {
  const entries = new Map();
  const missing = [];
  for (const raw of names) {
    const name = norm(raw.trim()).replace(/\.bib$/i, '');
    if (!name) continue;
    const cand = [baseDir + name + '.bib', name + '.bib'].find((c) => files.has(c));
    if (!cand) { missing.push(name + '.bib'); continue; }
    for (const [k, v] of parseBib(files.get(cand))) if (!entries.has(k)) entries.set(k, v);
  }
  return { entries, missing };
}

/**
 * files: Map<path, text> (project-relative). mainFile: e.g. "main.tex".
 * Returns { files, notes } where files is a (possibly) extended copy.
 */
export function prepareBibliography(files, mainFile) {
  const notes = [];
  const baseDir = dirOf(mainFile);
  const flat = flatten(files, mainFile, new Set(), baseDir);
  if (!flat) return { files, notes, bbl: null };

  const usesBiblatex = /\\usepackage\s*(\[[^\]]*\])?\s*\{[^}]*\bbiblatex\b[^}]*\}/.test(flat);
  const bibMatch = /\\bibliography\s*\{([^}]*)\}/.exec(flat);
  const resources = [...flat.matchAll(/\\addbibresource\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/g)].map((m) => m[1]);

  if (!usesBiblatex && !bibMatch) return { files, notes, bbl: null };

  const keys = [];
  for (const m of flat.matchAll(CITE_RE)) {
    const isNo = m[0].startsWith('\\nocite');
    for (const k of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!keys.includes(k)) keys.push(k);
      void isNo;
    }
  }
  const natbibLoaded = /\\usepackage\s*(\[[^\]]*\])?\s*\{[^}]*\bnatbib\b[^}]*\}/.test(flat);
  const out = new Map(files);

  if (!usesBiblatex) {
    const style = (/\\bibliographystyle\s*\{([^}]*)\}/.exec(flat) || [])[1] || 'plain';
    const { entries, missing } = allBibEntries(files, bibMatch[1].split(','), baseDir);
    for (const m of missing) notes.push({ level: 'warning', msg: `Bibliography file “${m}” not found in the project.` });
    const { bbl, notes: n2 } = makeBibliography(keys, entries, { style, natbib: natbibLoaded });
    notes.push(...n2);
    const job = mainFile.slice(baseDir.length).replace(/\.tex$/i, '');
    const path = baseDir + job + '.bbl';
    const text = bbl || '\\begin{thebibliography}{0}\n\\end{thebibliography}\n';
    out.set(path, text);
    return { files: out, notes, bbl: { path, text } };
  }

  // ---- biblatex: approximate with natbib -----------------------------------
  const optMatch = /\\usepackage\s*(?:\[([^\]]*)\])?\s*\{biblatex\}/.exec(flat);
  const opts = (optMatch && optMatch[1]) || '';
  const authorYear = /style\s*=\s*(authoryear|apa|chicago|authortitle)/i.test(opts);
  const sorting = /sorting\s*=\s*(none)/i.test(opts) ? 'unsrt' : 'plain';
  const { entries, missing } = allBibEntries(files, resources, baseDir);
  for (const m of missing) notes.push({ level: 'warning', msg: `Bibliography file “${m}” not found in the project.` });
  const { bbl, notes: n2 } = makeBibliography(keys, entries, { style: sorting, natbib: true });
  notes.push(...n2);
  notes.push({
    level: 'info',
    msg: 'biblatex needs Biber, which cannot run in the browser. This compile used natbib with an equivalent bibliography instead; your source files were not changed.',
  });

  const natbibPkg = `\\usepackage[${authorYear ? 'authoryear,round' : 'numbers,sort&compress'}]{natbib}`;
  const rewrite = (src) =>
    src
      .replace(/^([^%\n]*)\\usepackage\s*(?:\[[^\]]*\])?\s*\{biblatex\}/m, (m, pre) => pre + natbibPkg)
      .replace(/\\addbibresource\s*(?:\[[^\]]*\])?\s*\{[^}]*\}/g, '')
      .replace(/\\printbibliography\s*(?:\[[^\]]*\])?/g, () => bbl || '')
      .replace(/\\(?:parencite|autocite|Parencite|Autocite)\b/g, '\\citep')
      .replace(/\\(?:textcite|Textcite)\b/g, '\\citet')
      .replace(/\\(?:footcite|smartcite|supercite|footcitetext)\b/g, '\\cite');
  for (const [p, src] of files) if (/\.tex$/i.test(p)) out.set(p, rewrite(src));
  return { files: out, notes, bbl: null };
}
