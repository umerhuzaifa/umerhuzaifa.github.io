// The project workspace: file tree, source editor, PDF preview, logs.

import * as db from './db.js';
import * as settings from './settings.js';
import { Editor } from './editor.js';
import { PdfViewer } from './pdfview.js';
import { compile, warmup, clean as cleanEngine } from './compile.js';
import { parseBib, flatten, stripComments } from './bib.js';
import { exportProject, isTextPath, isImagePath, extOf } from './zip.js';
import { openSearchPanel } from '@codemirror/search';
import { h, $, icon, iconBtn, modal, askText, askConfirm, menu, toast, timeAgo, bytes, download } from './ui.js';
import { brand, themeButton } from './dashboard.js';

const SECTION_RE = /^\s*\\(part|chapter|section|subsection|subsubsection|paragraph)\*?\s*(?:\[[^\]]*\])?\s*\{(.*)\}/;
const LEVEL = { part: 0, chapter: 0, section: 1, subsection: 2, subsubsection: 3, paragraph: 4 };

const dirOf = (p) => { const s = p.lastIndexOf('/'); return s === -1 ? '' : p.slice(0, s); };
const baseOf = (p) => p.slice(p.lastIndexOf('/') + 1);
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function validPath(p) {
  p = p.trim().replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
  if (!p) throw new Error('Name cannot be empty.');
  if (p.split('/').some((s) => s === '.' || s === '..')) throw new Error('“.” and “..” are not allowed in names.');
  if (/[\\:*?"<>|\u0000]/.test(p)) throw new Error('Names cannot contain \\ : * ? " < > |');
  return p;
}

export async function openEditor(root, id) {
  const project = await db.getProject(id);
  if (!project) {
    toast('That project no longer exists.', 'error');
    location.hash = '#/';
    return () => {};
  }
  const S = {
    project,
    files: new Map(), // path -> record
    current: null,
    expanded: new Set(JSON.parse(sessionStorage.getItem('texlab.exp.' + id) || '[""]')),
    dirty: new Set(),
    version: 0, // bumps on any content change (cache key for completions)
    compiling: false,
    queued: false,
    lastPdf: null,
    lastResult: null,
    issues: [],
    showTypeset: false,
    logTab: 'issues',
    selected: null,
  };
  for (const r of await db.listFiles(id)) S.files.set(r.path, r);

  const cleanups = [];
  const timers = {};
  const debounce = (name, ms, fn) => { clearTimeout(timers[name]); timers[name] = setTimeout(fn, ms); };

  // ------------------------------------------------------------ file helpers
  const isText = (r) => !r.dir && !r.bin;
  const texFiles = () => [...S.files.values()].filter((r) => isText(r) && /\.tex$/i.test(r.path));
  const mainDir = () => (dirOf(S.project.main) ? dirOf(S.project.main) + '/' : '');
  const relToMain = (p) => (p.startsWith(mainDir()) ? p.slice(mainDir().length) : p);

  function ensureMain() {
    if (S.files.has(S.project.main)) return;
    const cands = texFiles();
    const pick = cands.find((r) => /\\documentclass/.test(r.content)) || cands[0];
    if (pick) { S.project.main = pick.path; db.saveProject(S.project); }
  }
  ensureMain();

  async function ensureDirs(path) {
    const parts = path.split('/');
    const made = [];
    for (let i = 1; i < parts.length; i++) {
      const d = parts.slice(0, i).join('/');
      if (!S.files.has(d)) {
        const rec = { path: d, dir: true, bin: false, content: '' };
        S.files.set(d, rec);
        made.push(rec);
      }
      S.expanded.add(d);
    }
    if (made.length) await db.putFiles(id, made);
  }

  async function addFile(path, { bin = false, content = '' } = {}) {
    await ensureDirs(path);
    const rec = { path, dir: false, bin, content };
    S.files.set(path, rec);
    await db.putFile(id, rec);
    S.version++;
    return rec;
  }

  // -------------------------------------------------------------- DOM shell
  const el = {};
  const dom = h('div', { class: 'ed-root', dataset: { pane: 'source' } });

  const titleBtn = h('button', { class: 'proj-title', title: 'Rename project', onClick: renameProject }, S.project.name);
  const saveState = h('span', { class: 'save-state', 'aria-live': 'polite' }, '');
  const compileLabel = h('span', null, 'Recompile');
  const compileBtn = h('button', { class: 'btn primary compile-main', onClick: () => recompile(true), title: 'Recompile (Ctrl/⌘ + Enter)' }, icon('play', 14), compileLabel);
  const compileMore = h('button', { class: 'btn primary compile-more', 'aria-label': 'Compile options', onClick: (e) => compileMenu(e.currentTarget) }, icon('chevD', 14));
  const statusChip = h('span', { class: 'chip idle', role: 'status' }, 'Not compiled yet');
  const logToggle = h('button', { class: 'btn ghost log-toggle', onClick: () => toggleLog() }, icon('list'), h('span', { class: 'lt-label' }, 'Logs'), h('span', { class: 'badge hidden' }));

  const top = h('header', { class: 'ed-top' },
    h('a', { class: 'icon-btn', href: '#/', title: 'All projects', 'aria-label': 'All projects' }, icon('back')),
    h('div', { class: 'brand-sm' }, brand()),
    iconBtn('sidebar', 'Toggle file tree', () => toggleSidebar(), 'side-toggle'),
    titleBtn,
    saveState,
    h('div', { class: 'grow' }),
    h('div', { class: 'seg mobile-only', role: 'tablist' },
      h('button', { role: 'tab', class: 'on', 'data-p': 'source', onClick: () => setPane('source') }, 'Source'),
      h('button', { role: 'tab', 'data-p': 'pdf', onClick: () => setPane('pdf') }, 'PDF')),
    statusChip,
    h('button', { class: 'btn ghost', onClick: (e) => mainMenu(e.currentTarget) }, icon('menu'), h('span', { class: 'hide-sm' }, 'Menu')),
    themeButton(),
    h('div', { class: 'split-btn' }, compileBtn, compileMore)
  );

  // sidebar ---------------------------------------------------------------
  el.tree = h('div', { class: 'tree', role: 'tree', tabindex: '0', 'aria-label': 'Project files' });
  el.outline = h('div', { class: 'outline-list' });
  const outlineHead = h('button', { class: 'side-head toggle', onClick: () => { outlineOpen = !outlineOpen; drawOutline(); } }, icon('chevD', 12), 'File outline');
  let outlineOpen = true;
  const uploadInput = h('input', { type: 'file', multiple: true, hidden: true, onChange: async (e) => { await uploadFiles([...e.target.files].map((f) => ({ path: f.name, file: f })), uploadTarget); e.target.value = ''; } });
  let uploadTarget = '';
  const side = h('aside', { class: 'side' },
    h('div', { class: 'side-head' },
      h('span', { class: 'side-title' }, 'Files'),
      h('div', { class: 'side-tools' },
        iconBtn('filePlus', 'New file', () => newFile(targetDir())),
        iconBtn('folderPlus', 'New folder', () => newFolder(targetDir())),
        iconBtn('upload', 'Upload files', () => { uploadTarget = targetDir(); uploadInput.click(); }))),
    el.tree,
    outlineHead,
    el.outline,
    uploadInput
  );

  // source pane -------------------------------------------------------------
  const cmHost = h('div', { class: 'cm-host' });
  el.bin = h('div', { class: 'bin-host hidden' });
  const cursorPos = h('span', { class: 'cursor-pos' }, 'Ln 1, Col 1');
  const fileLabel = h('span', { class: 'file-label' }, '');
  const sectionSel = h('select', { class: 'tb-select', 'aria-label': 'Insert heading', onChange: (e) => { const v = e.target.value; e.target.value = ''; if (v) editor.wrap(`\\${v}{`, '}'); } },
    h('option', { value: '' }, 'Heading'),
    ...['section', 'subsection', 'subsubsection', 'paragraph', 'chapter'].map((s) => h('option', { value: s }, s[0].toUpperCase() + s.slice(1))));
  const tb = (label, title, fn, cls = '') => h('button', { class: 'tb ' + cls, title, 'aria-label': title, onClick: fn, onMousedown: (e) => e.preventDefault() }, label);
  const toolbar = h('div', { class: 'edtb', role: 'toolbar', 'aria-label': 'Formatting' },
    sectionSel,
    tb(icon('bold'), 'Bold (Ctrl/⌘ B)', () => editor.wrap('\\textbf{', '}')),
    tb(icon('italic'), 'Italic (Ctrl/⌘ I)', () => editor.wrap('\\textit{', '}')),
    tb(h('u', null, 'U'), 'Underline', () => editor.wrap('\\underline{', '}')),
    h('span', { class: 'tb-sep' }),
    tb(h('span', { class: 'mathy' }, '$x$'), 'Inline math', () => editor.wrap('$', '$')),
    tb(h('span', { class: 'mathy' }, '∑'), 'Display math', () => editor.insertBlock('\\[\n\t\n\\]', 4)),
    h('span', { class: 'tb-sep' }),
    tb(icon('link'), 'Link', () => editor.wrap('\\href{}{', '}')),
    tb(h('span', { class: 'mathy' }, 'ref'), 'Cross-reference', () => editor.wrap('\\ref{', '}')),
    tb(icon('quote'), 'Citation', () => editor.wrap('\\cite{', '}')),
    tb(icon('image'), 'Insert figure', (e) => figureMenu(e.currentTarget)),
    tb(icon('words'), 'Insert table', () => editor.insertBlock('\\begin{table}[h]\n\t\\centering\n\t\\begin{tabular}{lll}\n\t\t\\hline\n\t\tA & B & C \\\\\n\t\t\\hline\n\t\t1 & 2 & 3 \\\\\n\t\t\\hline\n\t\\end{tabular}\n\t\\caption{Caption}\n\t\\label{tab:}\n\\end{table}', 0)),
    h('span', { class: 'tb-sep' }),
    tb(icon('list'), 'Bullet list', () => editor.insertBlock('\\begin{itemize}\n\t\\item \n\\end{itemize}', 24)),
    tb(icon('numbered'), 'Numbered list', () => editor.insertBlock('\\begin{enumerate}\n\t\\item \n\\end{enumerate}', 26)),
    h('span', { class: 'tb-sep' }),
    tb(icon('comment'), 'Toggle comment (Ctrl/⌘ /)', () => { editor.toggleComment(); editor.focus(); }),
    tb(icon('search'), 'Find & replace (Ctrl/⌘ F)', () => { openSearchPanel(editor.view); editor.focus(); })
  );

  const srcPane = h('section', { class: 'src' },
    h('div', { class: 'pane-bar' }, fileLabel, h('div', { class: 'grow' })),
    toolbar,
    cmHost,
    el.bin,
    h('div', { class: 'statusbar' }, cursorPos, h('div', { class: 'grow' }), h('span', { class: 'hint' }, 'Ctrl/⌘ + Enter to compile'))
  );

  // output pane ---------------------------------------------------------------
  const pageInput = h('input', { class: 'page-input', type: 'number', min: '1', value: '1', 'aria-label': 'Page', onChange: (e) => viewer.goTo(parseInt(e.target.value, 10) || 1) });
  const pageTotal = h('span', { class: 'page-total' }, '/ –');
  const zoomSel = h('select', { class: 'tb-select', 'aria-label': 'Zoom', onChange: (e) => viewer.setMode(e.target.value === 'fit' ? 'fit' : parseFloat(e.target.value)) },
    h('option', { value: 'fit' }, 'Fit width'),
    ...[0.5, 0.75, 1, 1.25, 1.5, 2, 3].map((z) => h('option', { value: String(z) }, Math.round(z * 100) + '%')),
    h('option', { value: 'custom', hidden: true }, ''));
  const pdfScroll = h('div', { class: 'pdf-scroll', tabindex: '0', 'aria-label': 'PDF preview' });
  el.msg = h('div', { class: 'pdf-msg' });
  const logPanel = h('div', { class: 'log-panel hidden' });
  const outPane = h('section', { class: 'out' },
    h('div', { class: 'pane-bar pdf-tools' },
      iconBtn('minus', 'Zoom out', () => viewer.zoomBy(1 / 1.15)),
      zoomSel,
      iconBtn('plus', 'Zoom in', () => viewer.zoomBy(1.15)),
      iconBtn('fit', 'Fit width', () => viewer.setMode('fit')),
      h('span', { class: 'tb-sep' }),
      pageInput, pageTotal,
      h('div', { class: 'grow' }),
      logToggle,
      iconBtn('download', 'Download PDF', downloadPdf)),
    h('div', { class: 'pdf-wrap' }, pdfScroll, el.msg, logPanel)
  );

  const split1 = h('div', { class: 'splitter', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Resize file tree' });
  const split2 = h('div', { class: 'splitter', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Resize editor' });
  const body = h('div', { class: 'ed-body' }, side, split1, srcPane, split2, outPane);
  dom.append(top, body);
  root.replaceChildren(dom);

  const viewer = new PdfViewer(pdfScroll, {
    onPage: (n, total) => { pageInput.value = String(n); pageTotal.textContent = '/ ' + total; },
    onZoom: (scale, mode) => {
      if (mode === 'fit') zoomSel.value = 'fit';
      else {
        const m = [...zoomSel.options].find((o) => Math.abs(parseFloat(o.value) - scale) < 0.005);
        if (m) zoomSel.value = m.value;
        else { const c = zoomSel.querySelector('option[value=custom]'); c.hidden = false; c.textContent = Math.round(scale * 100) + '%'; zoomSel.value = 'custom'; }
      }
    },
  });
  showMessage('Compile to see your PDF here.');

  // ------------------------------------------------------------ the editor
  const getters = {
    labels: () => cached('labels', () => {
      const set = new Set();
      for (const r of texFiles()) for (const m of stripComments(r.content).matchAll(/\\label\{([^}]+)\}/g)) set.add(m[1]);
      return [...set].sort(collator.compare);
    }),
    cites: () => cached('cites', () => {
      const out = [];
      for (const r of S.files.values()) {
        if (!isText(r) || !/\.bib$/i.test(r.path)) continue;
        for (const e of parseBib(r.content).values()) {
          const au = (e.fields.author || e.fields.editor || '').split(/\s+and\s+/)[0].split(',')[0];
          out.push({ key: e.key, detail: [au, e.fields.year].filter(Boolean).join(' ') + (e.fields.title ? ' – ' + e.fields.title.replace(/[{}]/g, '').slice(0, 50) : '') });
        }
      }
      return out;
    }),
    images: () => [...S.files.values()].filter((r) => r.bin && /\.(png|jpe?g|pdf|eps)$/i.test(r.path)).map((r) => relToMain(r.path)),
    texFiles: () => texFiles().map((r) => relToMain(r.path).replace(/\.tex$/i, '')),
    bibFiles: () => [...S.files.values()].filter((r) => /\.bib$/i.test(r.path)).map((r) => relToMain(r.path).replace(/\.bib$/i, '')),
  };
  const cache = {};
  function cached(key, fn) {
    if (cache[key]?.v !== S.version) cache[key] = { v: S.version, val: fn() };
    return cache[key].val;
  }

  const editor = new Editor(cmHost, {
    getters,
    onChange: (text) => {
      const rec = S.files.get(S.current);
      if (!rec) return;
      rec.content = text;
      S.version++;
      S.dirty.add(rec.path);
      scheduleSave();
      debounce('outline', 250, drawOutline);
      if (settings.get().autoCompile) debounce('auto', 2200, () => recompile());
    },
    onSave: () => { flushSaves(); recompile(true); },
    onCompile: () => recompile(true),
    onSelection: (state) => {
      const pos = state.selection.main.head;
      const line = state.doc.lineAt(pos);
      cursorPos.textContent = `Ln ${line.number}, Col ${pos - line.from + 1}`;
    },
  });

  // ------------------------------------------------------------- saving
  function scheduleSave() {
    saveState.textContent = 'Saving…';
    saveState.className = 'save-state busy';
    debounce('save', 500, flushSaves);
  }
  async function flushSaves() {
    clearTimeout(timers.save);
    if (!S.dirty.size) return;
    const paths = [...S.dirty];
    S.dirty.clear();
    try {
      await db.putFiles(id, paths.map((p) => S.files.get(p)).filter(Boolean));
      await db.touchProject(id);
      saveState.textContent = 'Saved';
      saveState.className = 'save-state ok';
      clearTimeout(timers.savedFade);
      timers.savedFade = setTimeout(() => { saveState.textContent = ''; }, 2500);
    } catch (err) {
      saveState.textContent = 'Save failed';
      saveState.className = 'save-state err';
      toast('Could not save: ' + err.message, 'error', 6000);
    }
  }
  const onHide = () => { if (document.visibilityState === 'hidden') flushSaves(); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flushSaves);
  cleanups.push(() => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flushSaves); });

  // ---------------------------------------------------------- file tree
  function targetDir() {
    const s = S.selected;
    if (s == null) return '';
    const r = S.files.get(s);
    if (!r) return '';
    return r.dir ? r.path : dirOf(r.path);
  }

  function buildTree() {
    const root = { name: '', path: '', dir: true, kids: new Map() };
    for (const r of S.files.values()) {
      const parts = r.path.split('/');
      let node = root;
      parts.forEach((part, i) => {
        const p = parts.slice(0, i + 1).join('/');
        let k = node.kids.get(part);
        if (!k) { k = { name: part, path: p, dir: i < parts.length - 1 || r.dir, kids: new Map(), rec: null }; node.kids.set(part, k); }
        if (i === parts.length - 1) { k.rec = r; k.dir = r.dir; }
        node = k;
      });
    }
    return root;
  }

  function fileIcon(rec) {
    const e = extOf(rec.path);
    if (e === 'tex') return 'tex';
    if (e === 'bib') return 'bib';
    if (isImagePath(rec.path)) return 'image';
    if (e === 'pdf') return 'pdf';
    return 'file';
  }

  function drawTree() {
    const rows = [];
    const walk = (node, depth) => {
      const kids = [...node.kids.values()].sort((a, b) => (a.dir === b.dir ? collator.compare(a.name, b.name) : a.dir ? -1 : 1));
      for (const k of kids) {
        const open = S.expanded.has(k.path);
        const selected = S.selected === k.path;
        const isMain = !k.dir && k.path === S.project.main;
        const more = h('button', { class: 'row-more', 'aria-label': 'Actions', tabindex: '-1', onClick: (e) => { e.stopPropagation(); rowMenu(k, e.currentTarget); } }, icon('more', 14));
        const row = h(
          'div',
          {
            class: 'trow' + (selected ? ' sel' : '') + (!k.dir && S.current === k.path ? ' cur' : ''),
            role: 'treeitem',
            'aria-selected': String(selected),
            'aria-expanded': k.dir ? String(open) : null,
            style: { paddingLeft: 8 + depth * 14 + 'px' },
            draggable: 'true',
            dataset: { path: k.path, dir: k.dir ? '1' : '' },
            title: k.path,
            onClick: () => {
              S.selected = k.path;
              if (k.dir) { open ? S.expanded.delete(k.path) : S.expanded.add(k.path); persistExpanded(); drawTree(); }
              else { openFile(k.path); if (innerWidth < 900) dom.classList.remove('side-open'); }
            },
            onContextmenu: (e) => { e.preventDefault(); S.selected = k.path; drawTree(); menu(null, rowMenuItems(k), { at: { x: e.clientX, y: e.clientY } }); },
            onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } },
            tabindex: '-1',
          },
          k.dir ? icon(open ? 'chevD' : 'chevR', 12) : h('span', { class: 'chev-space' }),
          icon(k.dir ? (open ? 'folderOpen' : 'folder') : fileIcon(k.rec), 15),
          h('span', { class: 'tname' }, k.name),
          isMain ? h('span', { class: 'main-badge', title: 'Main document' }, 'main') : null,
          more
        );
        wireDnD(row, k);
        rows.push(row);
        if (k.dir && open) walk(k, depth + 1);
      }
    };
    walk(buildTree(), 0);
    el.tree.replaceChildren(...rows);
    if (!rows.length) el.tree.append(h('div', { class: 'tree-empty' }, 'No files yet.'));
  }

  function persistExpanded() {
    try { sessionStorage.setItem('texlab.exp.' + id, JSON.stringify([...S.expanded])); } catch {}
  }

  function rowMenu(k, anchor) { menu(anchor, rowMenuItems(k), { align: 'right' }); }

  function rowMenuItems(k) {
    const rec = k.rec;
    const items = [];
    if (k.dir) {
      items.push(
        { label: 'New file', icon: 'filePlus', onClick: () => newFile(k.path) },
        { label: 'New folder', icon: 'folderPlus', onClick: () => newFolder(k.path) },
        { label: 'Upload here…', icon: 'upload', onClick: () => { uploadTarget = k.path; uploadInput.click(); } },
        { sep: true }
      );
    } else {
      items.push({ label: 'Open', icon: 'edit', onClick: () => openFile(k.path) });
      if (/\.tex$/i.test(k.path)) items.push({ label: 'Set as main document', icon: 'star', disabled: k.path === S.project.main, onClick: () => setMain(k.path) });
      items.push({ label: 'Download', icon: 'download', onClick: () => download(new Blob([rec.content]), baseOf(k.path)) });
      items.push({ sep: true });
    }
    items.push({ label: 'Rename', icon: 'edit', onClick: () => renamePath(k.path) });
    items.push({ label: 'Delete', icon: 'trash', danger: true, onClick: () => deletePath(k.path) });
    return items;
  }

  // drag & drop: move inside the tree, or drop files from the desktop
  function wireDnD(row, k) {
    row.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/x-texlab-path', k.path);
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      row.classList.add('drop');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop'));
    row.addEventListener('drop', (e) => { row.classList.remove('drop'); e.stopPropagation(); handleDrop(e, k.dir ? k.path : dirOf(k.path)); });
  }
  el.tree.addEventListener('dragover', (e) => e.preventDefault());
  el.tree.addEventListener('drop', (e) => handleDrop(e, ''));

  async function handleDrop(e, dir) {
    e.preventDefault();
    const moving = e.dataTransfer.getData('text/x-texlab-path');
    if (moving) {
      const name = baseOf(moving);
      const to = dir ? dir + '/' + name : name;
      if (to === moving || to.startsWith(moving + '/') || dirOf(moving) === dir) return;
      if (S.files.has(to)) return toast(`“${name}” already exists in that folder.`, 'error');
      await movePath(moving, to);
      return;
    }
    // collect entries synchronously (the DataTransfer is cleared after the first await)
    const entries = [...(e.dataTransfer.items || [])].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
    const plain = [...(e.dataTransfer.files || [])];
    const list = entries.length ? await readEntries(entries) : plain.map((f) => ({ path: f.name, file: f }));
    await uploadFiles(list, dir);
  }

  async function readEntries(entries) {
    const out = [];
    const walk = async (entry, prefix) => {
      if (entry.isFile) {
        const file = await new Promise((res, rej) => entry.file(res, rej));
        out.push({ path: prefix + entry.name, file });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        for (;;) {
          const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
          if (!batch.length) break;
          for (const c of batch) await walk(c, prefix + entry.name + '/');
        }
      }
    };
    for (const e of entries) await walk(e, '');
    return out;
  }

  async function uploadFiles(list, dir) {
    if (!list.length) return;
    let n = 0, replaced = 0;
    for (const { path, file } of list) {
      if (/(^|\/)(\.DS_Store|Thumbs\.db)$/.test(path)) continue;
      let full;
      try { full = validPath(dir ? dir + '/' + path : path); } catch (err) { toast(err.message, 'error'); continue; }
      const text = isTextPath(full);
      const content = text ? await file.text() : await file.arrayBuffer();
      if (S.files.has(full)) replaced++;
      await addFile(full, { bin: !text, content: text && content.charCodeAt(0) === 0xfeff ? content.slice(1) : content });
      n++;
    }
    if (dir) S.expanded.add(dir);
    drawTree();
    ensureMain();
    if (S.current && S.files.get(S.current) && isText(S.files.get(S.current))) {
      // the open file may have been replaced
      editor.forget(S.current);
      openFile(S.current, undefined, true);
    }
    toast(`Uploaded ${n} file${n === 1 ? '' : 's'}${replaced ? ` (replaced ${replaced})` : ''}`, 'ok');
    await db.touchProject(id);
  }

  async function newFile(dir) {
    const name = await askText({ title: 'New file', label: 'File name', value: 'untitled.tex', ok: 'Create', placeholder: 'chapter1.tex' });
    if (!name) return;
    try {
      let path = validPath(dir ? dir + '/' + name : name);
      if (!/\.[^./]+$/.test(path)) path += '.tex';
      if (S.files.has(path)) return toast('A file with that name already exists.', 'error');
      await addFile(path, { content: '' });
      drawTree();
      openFile(path);
    } catch (err) { toast(err.message, 'error'); }
  }

  async function newFolder(dir) {
    const name = await askText({ title: 'New folder', label: 'Folder name', value: 'figures', ok: 'Create', select: true });
    if (!name) return;
    try {
      const path = validPath(dir ? dir + '/' + name : name);
      if (S.files.has(path)) return toast('That name is already taken.', 'error');
      await ensureDirs(path + '/x');
      drawTree();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function renamePath(path) {
    const rec = S.files.get(path);
    const name = await askText({ title: 'Rename', value: baseOf(path), ok: 'Rename', select: !rec?.dir });
    if (!name || name === baseOf(path)) return;
    try {
      const to = validPath(dirOf(path) ? dirOf(path) + '/' + name : name);
      if (S.files.has(to)) return toast('That name is already taken.', 'error');
      await movePath(path, to);
    } catch (err) { toast(err.message, 'error'); }
  }

  async function movePath(from, to) {
    await flushSaves();
    await ensureDirs(to);
    await db.moveFile(id, from, to);
    const moved = [...S.files.entries()].filter(([p]) => p === from || p.startsWith(from + '/'));
    for (const [p, r] of moved) {
      S.files.delete(p);
      const np = to + p.slice(from.length);
      r.path = np;
      S.files.set(np, r);
    }
    editor.rename(from, to);
    if (S.current && (S.current === from || S.current.startsWith(from + '/'))) S.current = to + S.current.slice(from.length);
    if (S.selected && (S.selected === from || S.selected.startsWith(from + '/'))) S.selected = to + S.selected.slice(from.length);
    if (S.project.main === from || S.project.main.startsWith(from + '/')) { S.project.main = to + S.project.main.slice(from.length); await db.saveProject(S.project); }
    if (S.expanded.has(from)) { S.expanded.delete(from); S.expanded.add(to); }
    S.version++;
    drawTree();
    if (S.current) openFile(S.current, undefined, true);
  }

  async function deletePath(path) {
    const rec = S.files.get(path);
    if (!(await askConfirm({ title: 'Delete', message: `Delete “${baseOf(path)}”${rec?.dir ? ' and everything inside it' : ''}? This cannot be undone.`, ok: 'Delete', danger: true }))) return;
    await flushSaves();
    await db.deleteFile(id, path);
    for (const p of [...S.files.keys()]) if (p === path || p.startsWith(path + '/')) S.files.delete(p);
    editor.forget(path);
    S.version++;
    const wasCurrent = S.current && (S.current === path || S.current.startsWith(path + '/'));
    if (S.selected === path) S.selected = null;
    ensureMain();
    if (wasCurrent) { S.current = null; const next = S.files.get(S.project.main) ? S.project.main : [...S.files.values()].find((r) => !r.dir)?.path; next ? openFile(next) : showEmptyEditor(); }
    drawTree();
  }

  async function setMain(path) {
    S.project.main = path;
    await db.saveProject(S.project);
    drawTree();
    toast(`Main document is now ${path}`, 'ok');
    recompile(true);
  }

  // -------------------------------------------------------- opening files
  let blobUrl = null;
  function showEmptyEditor() {
    cmHost.classList.add('hidden');
    toolbar.classList.add('hidden');
    el.bin.classList.remove('hidden');
    el.bin.replaceChildren(h('div', { class: 'bin-card' }, h('p', null, 'Select a file from the tree, or create a new one.'), h('button', { class: 'btn', onClick: () => newFile('') }, icon('filePlus'), 'New file')));
    fileLabel.textContent = '';
  }

  function openFile(path, line, force = false) {
    const rec = S.files.get(path);
    if (!rec || rec.dir) return;
    if (S.current === path && !force && !line) { editor.focus(); return; }
    if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
    S.current = path;
    S.selected = path;
    fileLabel.textContent = path;
    try { localStorage.setItem('texlab.last.' + id, path); } catch {}
    if (isText(rec)) {
      cmHost.classList.remove('hidden');
      toolbar.classList.remove('hidden');
      el.bin.classList.add('hidden');
      editor.setFile(path, rec.content, line);
    } else {
      editor.stash();
      editor.current = null;
      cmHost.classList.add('hidden');
      toolbar.classList.add('hidden');
      el.bin.classList.remove('hidden');
      const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf', bmp: 'image/bmp' }[extOf(path)];
      const body = [];
      if (mime && mime.startsWith('image/')) {
        blobUrl = URL.createObjectURL(new Blob([rec.content], { type: mime }));
        body.push(h('img', { src: blobUrl, alt: path, class: 'bin-img' }));
      } else {
        body.push(h('div', { class: 'bin-ic' }, icon(extOf(path) === 'pdf' ? 'pdf' : 'file', 40)));
      }
      body.push(
        h('p', { class: 'bin-name' }, baseOf(path)),
        h('p', { class: 'bin-meta' }, bytes(rec.content.byteLength ?? 0) + ' · binary file'),
        h('button', { class: 'btn', onClick: () => download(new Blob([rec.content]), baseOf(path)) }, icon('download'), 'Download')
      );
      el.bin.replaceChildren(h('div', { class: 'bin-card' }, body));
    }
    // reveal in tree
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) S.expanded.add(parts.slice(0, i).join('/'));
    drawTree();
    drawOutline();
    el.tree.querySelector('.trow.cur')?.scrollIntoView({ block: 'nearest' });
    if (isText(rec) && innerWidth < 900) setPane('source');
  }

  function drawOutline() {
    outlineHead.firstChild.replaceWith(icon(outlineOpen ? 'chevD' : 'chevR', 12));
    const rec = S.files.get(S.current);
    if (!outlineOpen) { el.outline.replaceChildren(); el.outline.classList.add('hidden'); return; }
    el.outline.classList.remove('hidden');
    if (!rec || !isText(rec) || !/\.tex$/i.test(rec.path)) { el.outline.replaceChildren(h('div', { class: 'tree-empty' }, 'No headings')); return; }
    const items = [];
    rec.content.split('\n').forEach((line, i) => {
      const m = SECTION_RE.exec(line);
      if (m) items.push({ level: LEVEL[m[1]], title: m[2].replace(/\\[a-zA-Z]+\s*/g, '').replace(/[{}]/g, ''), line: i + 1 });
    });
    if (!items.length) { el.outline.replaceChildren(h('div', { class: 'tree-empty' }, 'No headings')); return; }
    const min = Math.min(...items.map((x) => x.level));
    el.outline.replaceChildren(...items.map((x) =>
      h('button', { class: 'orow', style: { paddingLeft: 10 + (x.level - min) * 12 + 'px' }, title: x.title, onClick: () => editor.goToLine(x.line) }, x.title || '(untitled)')));
  }

  // ------------------------------------------------------------ compile
  function setChip(kind, text) {
    statusChip.className = 'chip ' + kind;
    statusChip.textContent = text;
  }

  async function recompile(force = false) {
    if (!S.files.get(S.project.main)) {
      ensureMain();
      if (!S.files.get(S.project.main)) return toast('Add a .tex file to compile.', 'error');
    }
    if (S.compiling) { S.queued = true; return; }
    S.compiling = true;
    S.queued = false;
    clearTimeout(timers.auto);
    await flushSaves();
    compileBtn.disabled = true;
    compileBtn.classList.add('busy');
    compileLabel.textContent = 'Compiling…';
    setChip('busy', 'Compiling…');

    const texts = new Map();
    const bins = new Map();
    for (const r of S.files.values()) {
      if (r.dir) continue;
      (r.bin ? bins : texts).set(r.path, r.content);
    }
    try {
      const res = await compile(S.project.main, texts, bins, { projectId: id, onStage: (s) => setChip('busy', s) });
      S.lastResult = res;
      S.issues = res.issues;
      const errs = res.issues.filter((i) => i.level === 'error').length;
      const warns = res.issues.filter((i) => i.level === 'warning').length;
      if (res.pdf && res.pdf.length) {
        S.lastPdf = res.pdf;
        try { await viewer.load(res.pdf); hideMessage(); } catch (err) { showMessage('The PDF could not be displayed: ' + err.message, true); }
      }
      if (res.status === 0) {
        setChip('ok', `Compiled in ${(res.ms / 1000).toFixed(1)} s` + (warns ? ` · ${warns} warning${warns > 1 ? 's' : ''}` : ''));
      } else {
        setChip('err', errs ? `${errs} error${errs > 1 ? 's' : ''}` : 'Compile failed');
        if (!S.lastPdf) showMessage(errs ? 'There are errors in the document. See the log for details.' : 'Compilation failed. See the log for details.', true);
        if (innerWidth < 900) setPane('pdf');
      }
      pushDiagnostics();
      drawLog();
      if (res.status !== 0) openLog();
    } catch (err) {
      console.error(err);
      setChip('err', 'Engine error');
      S.issues = [{ level: 'error', msg: String(err.message || err), file: null, line: null, context: '', hint: 'The LaTeX engine could not run. Reload the page; if this persists, check your network connection (TeX packages are downloaded on demand).' }];
      S.lastResult = { log: String(err.stack || err) };
      drawLog();
      openLog();
    } finally {
      S.compiling = false;
      compileBtn.disabled = false;
      compileBtn.classList.remove('busy');
      compileLabel.textContent = 'Recompile';
      if (S.queued) recompile();
    }
  }

  function pushDiagnostics() {
    const by = new Map();
    for (const i of S.issues) {
      if (!i.file || !i.line || i.level === 'typesetting' || i.level === 'info') continue;
      if (!by.has(i.file)) by.set(i.file, []);
      by.get(i.file).push({ line: i.line, severity: i.level === 'error' ? 'error' : 'warning', message: i.msg });
    }
    editor.setIssues(by);
  }

  async function compileMenu(anchor) {
    const auto = settings.get().autoCompile;
    menu(anchor, [
      { label: 'Auto compile', icon: 'refresh', checked: auto, onClick: () => { settings.set({ autoCompile: !auto }); toast(`Auto compile ${!auto ? 'on' : 'off'}`); } },
      { label: 'Recompile from scratch', icon: 'trash', onClick: async () => { cleanEngine(); recompile(true); } },
      { sep: true },
      { label: 'Download PDF', icon: 'download', onClick: downloadPdf, disabled: !S.lastPdf },
    ], { align: 'right' });
  }

  function downloadPdf() {
    if (!S.lastPdf) return toast('Compile first to get a PDF.');
    download(new Blob([S.lastPdf], { type: 'application/pdf' }), S.project.name.replace(/[\\/:*?"<>|]/g, '_') + '.pdf');
  }

  // ------------------------------------------------------------- messages / log
  function showMessage(text, isErr) {
    el.msg.className = 'pdf-msg' + (isErr ? ' err' : '');
    el.msg.replaceChildren(h('div', null, icon(isErr ? 'err' : 'tex', 32), h('p', null, text)));
    el.msg.classList.remove('hidden');
  }
  function hideMessage() { el.msg.classList.add('hidden'); }

  function toggleLog() { logPanel.classList.contains('hidden') ? openLog() : logPanel.classList.add('hidden'); }
  function openLog() { drawLog(); logPanel.classList.remove('hidden'); }

  function drawLog() {
    const badge = logToggle.querySelector('.badge');
    const errs = S.issues.filter((i) => i.level === 'error').length;
    const warns = S.issues.filter((i) => i.level === 'warning').length;
    badge.textContent = errs || warns || '';
    badge.className = 'badge' + (errs ? ' err' : warns ? ' warn' : ' hidden');

    const hasRealError = S.issues.some((i) => i.level === 'error' && !/^==> Fatal error|^Emergency stop/.test(i.msg));
    const shown = S.issues.filter((i) => (S.showTypeset || i.level !== 'typesetting') && !(hasRealError && /^==> Fatal error occurred/.test(i.msg)));
    const typesetCount = S.issues.filter((i) => i.level === 'typesetting').length;

    const cards = shown.length
      ? shown.map((i) => {
          const where = i.file && i.line ? `${i.file}, line ${i.line}` : i.file || '';
          const card = h(
            'div',
            { class: 'issue ' + i.level, tabindex: i.file && i.line ? '0' : null, role: i.file && i.line ? 'button' : null,
              onClick: () => { if (i.file && S.files.has(i.file)) { openFile(i.file, i.line || 1, true); if (innerWidth < 900) setPane('source'); } },
              onKeydown: (e) => { if (e.key === 'Enter') e.currentTarget.click(); } },
            h('div', { class: 'issue-head' }, icon(i.level === 'error' ? 'err' : i.level === 'warning' ? 'warn' : 'info', 16), h('span', { class: 'issue-msg' }, i.msg)),
            where ? h('div', { class: 'issue-where' }, where, i.source ? ` · ${i.source}` : '') : i.source ? h('div', { class: 'issue-where' }, i.source) : null,
            i.context ? h('pre', { class: 'issue-ctx' }, i.context) : null,
            i.hint ? h('div', { class: 'issue-hint' }, i.hint) : null
          );
          return card;
        })
      : [h('div', { class: 'issue ok' }, icon('check', 16), S.lastResult ? h('span', null, 'No problems found.') : h('span', null, 'Compile to see messages.'))];

    const raw = h('pre', { class: 'raw-log' }, S.lastResult?.log || 'No log yet.');
    const tabs = h('div', { class: 'log-tabs', role: 'tablist' },
      h('button', { role: 'tab', class: S.logTab === 'issues' ? 'on' : '', onClick: () => { S.logTab = 'issues'; drawLog(); } }, 'Issues', errs + warns ? h('span', { class: 'badge ' + (errs ? 'err' : 'warn') }, errs + warns) : null),
      h('button', { role: 'tab', class: S.logTab === 'raw' ? 'on' : '', onClick: () => { S.logTab = 'raw'; drawLog(); } }, 'Raw log'),
      h('div', { class: 'grow' }),
      S.logTab === 'issues' && typesetCount
        ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: S.showTypeset, onChange: (e) => { S.showTypeset = e.target.checked; drawLog(); } }), `Box warnings (${typesetCount})`)
        : null,
      S.logTab === 'raw'
        ? [iconBtn('copy', 'Copy log', async () => { try { await navigator.clipboard.writeText(S.lastResult?.log || ''); toast('Log copied', 'ok'); } catch { toast('Could not copy', 'error'); } }),
           iconBtn('download', 'Download log', () => download(new Blob([S.lastResult?.log || '']), 'output.log'))]
        : null,
      iconBtn('x', 'Close log', () => logPanel.classList.add('hidden'))
    );
    logPanel.replaceChildren(tabs, h('div', { class: 'log-body' }, S.logTab === 'issues' ? cards : raw));
  }

  // ------------------------------------------------------------- menus & dialogs
  function setPane(p) {
    dom.dataset.pane = p;
    $$seg().forEach((b) => b.classList.toggle('on', b.dataset.p === p));
  }
  const $$seg = () => [...top.querySelectorAll('.seg button')];

  function toggleSidebar(force) {
    const open = force ?? !dom.classList.contains('side-open');
    dom.classList.toggle('side-open', open);
    if (innerWidth >= 900) settings.set({ sidebarOpen: open }); // the phone drawer is not a preference
    applyLayout();
  }

  function mainMenu(anchor) {
    menu(anchor, [
      { header: 'Project' },
      { label: 'Download source (.zip)', icon: 'zip', onClick: async () => { await flushSaves(); download(await exportProject([...S.files.values()]), S.project.name.replace(/[\\/:*?"<>|]/g, '_') + '.zip'); } },
      { label: 'Download PDF', icon: 'download', onClick: downloadPdf },
      { label: 'Main document…', icon: 'star', onClick: mainDialog },
      { sep: true },
      { label: 'Version history', icon: 'history', onClick: historyDialog },
      { label: 'Word count', icon: 'words', onClick: wordCountDialog },
      { sep: true },
      { label: 'Settings', icon: 'sliders', onClick: settingsDialog },
      { label: 'Keyboard shortcuts', icon: 'keyboard', onClick: shortcutsDialog },
    ], { align: 'right' });
  }

  function mainDialog() {
    const sel = h('select', { class: 'input' }, ...texFiles().map((r) => h('option', { value: r.path, selected: r.path === S.project.main }, r.path)));
    modal({
      title: 'Main document',
      body: [h('p', { class: 'sub' }, 'The file that is compiled. It should contain \\documentclass.'), sel],
      actions: [{ label: 'Cancel' }, { label: 'Use this file', primary: true, onClick: (close) => { close(); if (sel.value !== S.project.main) setMain(sel.value); } }],
    });
  }

  function settingsDialog() {
    const st = settings.get();
    const theme = h('select', { class: 'input', onChange: (e) => settings.set({ theme: e.target.value }) },
      ...[['system', 'Match system'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => h('option', { value: v, selected: st.theme === v }, l)));
    const size = h('input', { class: 'input', type: 'number', min: '10', max: '24', value: st.fontSize, onChange: (e) => settings.set({ fontSize: Math.min(24, Math.max(10, parseInt(e.target.value, 10) || 14)) }) });
    const auto = h('input', { type: 'checkbox', checked: st.autoCompile, onChange: (e) => settings.set({ autoCompile: e.target.checked }) });
    modal({
      title: 'Settings',
      body: [
        h('label', { class: 'field-label' }, 'Theme'), theme,
        h('label', { class: 'field-label', style: { marginTop: '14px' } }, 'Editor font size (px)'), size,
        h('label', { class: 'check big', style: { marginTop: '14px' } }, auto, h('span', null, 'Auto compile while typing', h('small', null, 'Recompiles a couple of seconds after you stop typing.'))),
      ],
      actions: [{ label: 'Done', primary: true }],
    });
  }

  function shortcutsDialog() {
    const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
    const rows = [
      [`${mod} + Enter`, 'Recompile'],
      [`${mod} + S`, 'Save and recompile'],
      [`${mod} + B / I`, 'Bold / italic'],
      [`${mod} + /`, 'Comment or uncomment lines'],
      [`${mod} + F`, 'Find and replace'],
      [`${mod} + Z / Shift + Z`, 'Undo / redo'],
      ['Tab / Shift + Tab', 'Indent / outdent'],
      ['\\', 'Start command completion'],
      [`${mod} + ⌥/Alt + ↑↓`, 'Add cursor above / below'],
    ];
    modal({ title: 'Keyboard shortcuts', body: h('table', { class: 'kbd-table' }, ...rows.map(([k, d]) => h('tr', null, h('td', null, h('kbd', null, k)), h('td', null, d)))), actions: [{ label: 'Close', primary: true }] });
  }

  function figureMenu(anchor) {
    const imgs = [...S.files.values()].filter((r) => r.bin && /\.(png|jpe?g|pdf)$/i.test(r.path));
    const items = imgs.map((r) => ({
      label: r.path, icon: 'image',
      onClick: () => editor.insertBlock(`\\begin{figure}[h]\n\t\\centering\n\t\\includegraphics[width=0.8\\linewidth]{${relToMain(r.path)}}\n\t\\caption{Caption}\n\t\\label{fig:}\n\\end{figure}`, 0),
    }));
    if (items.length) items.push({ sep: true });
    items.push({ label: 'Upload image…', icon: 'upload', onClick: () => { uploadTarget = ''; uploadInput.accept = 'image/*,.pdf'; uploadInput.click(); setTimeout(() => (uploadInput.accept = ''), 1000); } });
    menu(anchor, items);
  }

  function wordCountDialog() {
    const texts = new Map();
    for (const r of texFiles()) texts.set(r.path, r.content);
    let flat = flatten(texts, S.project.main, new Set(), mainDir());
    const bodyStart = flat.indexOf('\\begin{document}');
    if (bodyStart !== -1) flat = flat.slice(bodyStart + 15);
    const endIdx = flat.indexOf('\\end{document}');
    if (endIdx !== -1) flat = flat.slice(0, endIdx);
    const headings = (flat.match(/\\(?:part|chapter|section|subsection|subsubsection)\*?\s*(?:\[[^\]]*\])?\{/g) || []).length;
    const displayMath = (flat.match(/\\\[|\$\$|\\begin\{(?:equation|align|gather|multline|eqnarray)\*?\}/g) || []).length;
    let t = flat
      .replace(/\\begin\{(equation|align|gather|multline|eqnarray|displaymath|math|verbatim|lstlisting)\*?\}[\s\S]*?\\end\{\1\*?\}/g, ' ')
      .replace(/\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/g, ' ');
    const inlineMath = (t.match(/\$[^$]+\$/g) || []).length;
    t = t
      .replace(/\$[^$]*\$/g, ' ')
      .replace(/\\(?:cite[a-z]*|ref|eqref|label|pageref|autoref|cref|includegraphics|input|include|usepackage|documentclass|bibliography|bibliographystyle|url|href|vspace|hspace|setlength|pagestyle|thispagestyle)\*?(?:\[[^\]]*\])*\{[^}]*\}/g, ' ')
      .replace(/\\[a-zA-Z]+\*?/g, ' ')
      .replace(/[{}\\&%~^_#]/g, ' ');
    const words = (t.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
    const chars = (t.match(/[\p{L}\p{N}]/gu) || []).length;
    const row = (k, v) => h('tr', null, h('td', null, k), h('td', { class: 'num' }, String(v)));
    modal({
      title: 'Word count',
      body: [h('table', { class: 'stat-table' }, row('Words in text', words), row('Letters and digits', chars), row('Headings', headings), row('Inline equations', inlineMath), row('Displayed equations', displayMath)), h('p', { class: 'fine' }, 'Counted from the main document and the files it includes. An approximation of what TeXcount reports.')],
      actions: [{ label: 'Close', primary: true }],
    });
  }

  async function historyDialog() {
    await flushSaves();
    const list = h('div', { class: 'ver-list' });
    const label = h('input', { class: 'input', type: 'text', placeholder: 'Label this version (optional)' });
    const draw = async () => {
      const vs = await db.listVersions(id);
      list.replaceChildren(
        ...(vs.length ? vs.map((v) => h('div', { class: 'ver' },
          h('div', { class: 'ver-main' }, h('b', null, v.label || (v.auto ? 'Automatic snapshot' : 'Saved version')), h('span', { class: 'sub' }, `${new Date(v.time).toLocaleString()} · ${timeAgo(v.time)} · ${v.files.filter((f) => !f.dir).length} files`)),
          h('button', { class: 'btn sm', onClick: async () => {
            if (!(await askConfirm({ title: 'Restore this version?', message: 'Your current files are saved as a version first, so you can undo this.', ok: 'Restore' }))) return;
            await db.saveVersion(id, 'Before restore', true);
            await db.replaceFiles(id, v.files);
            toast('Version restored. Reloading…', 'ok');
            setTimeout(() => location.reload(), 400);
          } }, 'Restore'),
          iconBtn('trash', 'Delete version', async () => { await db.deleteVersion(v.id); draw(); }))) : [h('p', { class: 'sub' }, 'No saved versions yet.')]));
    };
    modal({
      title: 'Version history',
      wide: true,
      body: [h('div', { class: 'ver-new' }, label, h('button', { class: 'btn primary', onClick: async () => { await db.saveVersion(id, label.value.trim(), false); label.value = ''; toast('Version saved', 'ok'); draw(); } }, 'Save version')), list],
      actions: [{ label: 'Close', primary: true }],
    });
    draw();
  }

  async function renameProject() {
    const n = await askText({ title: 'Rename project', value: S.project.name, ok: 'Rename', select: false });
    if (n) { S.project.name = n; titleBtn.textContent = n; document.title = n + ' · TeXLab'; await db.saveProject(S.project); }
  }

  // --------------------------------------------------------- layout (splitters)
  function applyLayout() {
    const st = settings.get();
    const open = dom.classList.contains('side-open');
    body.style.setProperty('--side-w', open ? st.sidebarWidth + 'px' : '0px');
    body.style.setProperty('--frac', String(st.editorFraction));
  }

  function drag(handle, onMove) {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      handle.classList.add('active');
      document.body.classList.add('dragging');
      const move = (ev) => onMove(ev);
      const up = () => {
        handle.classList.remove('active');
        document.body.classList.remove('dragging');
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });
  }
  drag(split1, (e) => {
    const r = body.getBoundingClientRect();
    settings.set({ sidebarWidth: Math.round(Math.min(480, Math.max(140, e.clientX - r.left))) });
    applyLayout();
  });
  drag(split2, (e) => {
    const r = body.getBoundingClientRect();
    const sideW = dom.classList.contains('side-open') ? settings.get().sidebarWidth + 5 : 0;
    const avail = r.width - sideW - 10;
    const frac = (e.clientX - r.left - sideW - 5) / avail;
    settings.set({ editorFraction: Math.min(0.8, Math.max(0.2, +frac.toFixed(3))) });
    applyLayout();
  });
  split1.addEventListener('dblclick', () => { settings.set({ sidebarWidth: 240 }); applyLayout(); });
  split2.addEventListener('dblclick', () => { settings.set({ editorFraction: 0.5 }); applyLayout(); });

  // global shortcut when focus is outside the editor
  const onKey = (e) => {
    if (e.defaultPrevented) return; // the editor already handled it
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); recompile(true); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); flushSaves(); recompile(true); }
  };
  document.addEventListener('keydown', onKey);
  cleanups.push(() => document.removeEventListener('keydown', onKey));

  // -------------------------------------------------------------- start up
  if (settings.get().sidebarOpen && innerWidth >= 900) dom.classList.add('side-open');
  applyLayout();
  drawTree();
  document.title = S.project.name + ' · TeXLab';

  let last = null;
  try { last = localStorage.getItem('texlab.last.' + id); } catch {}
  const first = (last && S.files.get(last) && !S.files.get(last).dir && last) || (S.files.get(S.project.main) && S.project.main) || [...S.files.values()].find((r) => !r.dir)?.path;
  if (first) openFile(first, undefined, true); else showEmptyEditor();

  // snapshot occasionally so there is always something to go back to
  (async () => {
    try {
      const vs = await db.listVersions(id);
      const newest = vs[0]?.time || 0;
      if (Date.now() - newest > 30 * 60 * 1000 && S.project.updated > newest) {
        await db.saveVersion(id, '', true);
        await db.pruneAutoVersions(id, 20);
      }
    } catch {}
  })();

  warmup();
  if (S.files.get(S.project.main)) recompile();

  return async () => {
    for (const t of Object.values(timers)) clearTimeout(t);
    await flushSaves();
    cleanups.forEach((fn) => fn());
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    viewer.clear();
    editor.destroy();
  };
}
