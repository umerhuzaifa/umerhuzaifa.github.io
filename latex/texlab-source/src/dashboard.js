// Project list: create from template, import zip, rename, copy, download, delete.

import * as db from './db.js';
import { TEMPLATES } from './templates.js';
import { h, icon, iconBtn, modal, askText, askConfirm, menu, toast, timeAgo, download } from './ui.js';
import { exportProject, readZip, guessMain, JSZip } from './zip.js';
import * as settings from './settings.js';

export function brand() {
  return h(
    'a',
    { class: 'brand', href: '#/', 'aria-label': 'TeXLab home' },
    h('span', { class: 'brand-mark', html: '<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--accent)"/><path d="M9 10h14M16 10v13M12 23h8" stroke="#fff" stroke-width="2.6" stroke-linecap="round" fill="none"/></svg>' }),
    h('span', { class: 'brand-name' }, 'TeX', h('b', null, 'Lab'))
  );
}

export function themeButton() {
  const btn = iconBtn('sun', 'Theme', (e) => {
    const cur = settings.get().theme;
    menu(btn, [
      { label: 'Match system', checked: cur === 'system', onClick: () => settings.set({ theme: 'system' }) },
      { label: 'Light', icon: 'sun', checked: cur === 'light', onClick: () => settings.set({ theme: 'light' }) },
      { label: 'Dark', icon: 'moon', checked: cur === 'dark', onClick: () => settings.set({ theme: 'dark' }) },
    ], { align: 'right' });
  });
  btn.classList.add('theme-btn');
  const sync = () => { btn.replaceChildren(icon(settings.effectiveTheme() === 'dark' ? 'moon' : 'sun')); };
  sync();
  settings.onChange(sync);
  return btn;
}

export async function importZipFile(file) {
  const files = await readZip(file);
  if (!files.some((f) => !f.dir && !f.bin)) throw new Error('This zip contains no text files.');
  // a TeXLab backup holds many projects
  const manifestIdx = files.findIndex((f) => f.path === 'texlab-backup.json');
  if (manifestIdx !== -1) {
    const manifest = JSON.parse(files[manifestIdx].content);
    let n = 0;
    for (const p of manifest.projects) {
      const prefix = p.dir + '/';
      const own = files.filter((f) => f.path.startsWith(prefix)).map((f) => ({ ...f, path: f.path.slice(prefix.length) })).filter((f) => f.path);
      await db.createProject({ name: p.name, main: p.main, files: own });
      n++;
    }
    return { count: n };
  }
  const name = file.name.replace(/\.zip$/i, '') || 'Imported project';
  const p = await db.createProject({ name, main: guessMain(files), files });
  return { count: 1, project: p };
}

async function uniqueName(base) {
  const names = new Set((await db.listProjects()).map((p) => p.name));
  if (!names.has(base)) return base;
  let i = 2;
  while (names.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}

export function renderDashboard(root) {
  let projects = [];
  let sortKey = 'updated';
  let sortDir = -1;
  let query = '';

  const listEl = h('div', { class: 'proj-list' });
  const search = h('input', {
    class: 'input search', type: 'search', placeholder: 'Search projects', 'aria-label': 'Search projects',
    onInput: (e) => { query = e.target.value.toLowerCase(); draw(); },
  });
  const fileInput = h('input', { type: 'file', accept: '.zip,application/zip', hidden: true, onChange: async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) await doImport(f);
  } });

  async function doImport(f) {
    try {
      toast('Importing…');
      const r = await importZipFile(f);
      toast(r.count > 1 ? `Imported ${r.count} projects` : 'Project imported', 'ok');
      if (r.project) location.hash = '#/p/' + r.project.id; else await refresh();
    } catch (err) {
      toast('Import failed: ' + err.message, 'error', 6000);
    }
  }

  function newProjectDialog() {
    let chosen = 'article';
    const name = h('input', { class: 'input', type: 'text', value: 'Untitled project', autofocus: true, spellcheck: 'false' });
    const grid = h('div', { class: 'tpl-grid', role: 'radiogroup', 'aria-label': 'Template' });
    const draw = () => {
      grid.replaceChildren(
        ...TEMPLATES.map((t) =>
          h(
            'button',
            { class: 'tpl' + (t.id === chosen ? ' on' : ''), role: 'radio', 'aria-checked': String(t.id === chosen), onClick: () => { chosen = t.id; draw(); } },
            h('span', { class: 'tpl-ic' }, icon(t.id === 'beamer' ? 'image' : t.id === 'article-bib' ? 'bib' : t.id === 'thesis' ? 'folder' : 'tex', 22)),
            h('span', { class: 'tpl-name' }, t.name),
            h('span', { class: 'tpl-blurb' }, t.blurb)
          )
        )
      );
    };
    draw();
    modal({
      title: 'New project',
      wide: true,
      body: [h('label', { class: 'field-label' }, 'Project name'), name, h('label', { class: 'field-label', style: { marginTop: '16px' } }, 'Start from'), grid],
      actions: [
        { label: 'Cancel' },
        {
          label: 'Create project',
          primary: true,
          onClick: async (close) => {
            const t = TEMPLATES.find((x) => x.id === chosen);
            const p = await db.createProject({
              name: await uniqueName(name.value.trim() || 'Untitled project'),
              main: t.main,
              files: t.files.map((f) => ({ ...f })),
            });
            close();
            location.hash = '#/p/' + p.id;
          },
        },
      ],
    });
  }

  async function exportAll() {
    const list = await db.listProjects();
    if (!list.length) return toast('Nothing to back up yet.');
    const zip = new JSZip();
    const manifest = { version: 1, projects: [] };
    const used = new Set();
    for (const p of list) {
      let dir = p.name.replace(/[\\/:*?"<>|]/g, '_');
      while (used.has(dir)) dir += '_';
      used.add(dir);
      manifest.projects.push({ name: p.name, main: p.main, dir });
      for (const f of await db.listFiles(p.id)) {
        if (f.dir) zip.folder(`${dir}/${f.path}`);
        else zip.file(`${dir}/${f.path}`, f.content, { binary: !!f.bin });
      }
    }
    zip.file('texlab-backup.json', JSON.stringify(manifest, null, 2));
    download(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), `texlab-backup-${new Date().toISOString().slice(0, 10)}.zip`);
  }

  function rowMenu(p, anchor) {
    menu(anchor, [
      { label: 'Open', icon: 'edit', onClick: () => (location.hash = '#/p/' + p.id) },
      {
        label: 'Rename', icon: 'edit',
        onClick: async () => {
          const n = await askText({ title: 'Rename project', value: p.name, ok: 'Rename', select: false });
          if (n) { p.name = n; await db.saveProject(p); refresh(); }
        },
      },
      {
        label: 'Make a copy', icon: 'copyfile',
        onClick: async () => { await db.duplicateProject(p.id, await uniqueName(p.name + ' (copy)')); refresh(); },
      },
      {
        label: 'Download source (.zip)', icon: 'zip',
        onClick: async () => download(await exportProject(await db.listFiles(p.id)), p.name.replace(/[\\/:*?"<>|]/g, '_') + '.zip'),
      },
      { sep: true },
      {
        label: 'Delete', icon: 'trash', danger: true,
        onClick: async () => {
          if (await askConfirm({ title: 'Delete project', message: `“${p.name}” and its version history will be permanently deleted from this browser.`, ok: 'Delete', danger: true })) {
            await db.deleteProject(p.id);
            refresh();
          }
        },
      },
    ], { align: 'right' });
  }

  function header(key, label, cls = '') {
    return h(
      'button',
      { class: 'th ' + cls, onClick: () => { if (sortKey === key) sortDir *= -1; else { sortKey = key; sortDir = key === 'name' ? 1 : -1; } draw(); } },
      label,
      sortKey === key ? icon(sortDir === 1 ? 'chevD' : 'chevD', 12) : null
    );
  }

  function draw() {
    let list = projects.filter((p) => p.name.toLowerCase().includes(query));
    list.sort((a, b) => (sortKey === 'name' ? a.name.localeCompare(b.name) : a[sortKey] - b[sortKey]) * sortDir);

    if (!projects.length) {
      listEl.replaceChildren(
        h('div', { class: 'empty' },
          h('div', { class: 'empty-art' }, icon('tex', 40)),
          h('h2', null, 'Write your first document'),
          h('p', null, 'Projects live in this browser and compile to PDF right here, with no account or server.'),
          h('div', { class: 'empty-actions' },
            h('button', { class: 'btn primary lg', onClick: newProjectDialog }, icon('plus'), 'New project'),
            h('button', { class: 'btn lg', onClick: () => fileInput.click() }, icon('upload'), 'Upload .zip')
          )
        )
      );
      return;
    }
    listEl.replaceChildren(
      h('div', { class: 'proj-head' }, header('name', 'Name'), header('updated', 'Last modified', 'right'), h('span', { class: 'th-actions' })),
      ...(list.length
        ? list.map((p) => {
            const more = iconBtn('more', 'Project actions', (e) => { e.stopPropagation(); e.preventDefault(); rowMenu(p, e.currentTarget); });
            return h(
              'a',
              { class: 'proj-row', href: '#/p/' + p.id, onContextmenu: (e) => { e.preventDefault(); menu(null, [], {}); rowMenu(p, more); } },
              h('span', { class: 'proj-name' }, icon('tex', 18), h('span', null, p.name)),
              h('span', { class: 'proj-date' }, timeAgo(p.updated)),
              more
            );
          })
        : [h('div', { class: 'no-match' }, `No projects match “${query}”.`)])
    );
  }

  async function refresh() {
    projects = await db.listProjects();
    draw();
  }

  root.replaceChildren(
    h('header', { class: 'dash-top' },
      brand(),
      h('div', { class: 'grow' }),
      h('a', { class: 'link-btn', href: 'https://umerhuzaifa.com', target: '_top' }, 'umerhuzaifa.com'),
      themeButton()
    ),
    h('main', { class: 'dash' },
      h('div', { class: 'dash-title' },
        h('div', null, h('h1', null, 'Projects'), h('p', { class: 'sub' }, 'Stored privately in this browser. Compiled locally with pdfTeX.')),
        h('div', { class: 'dash-actions' },
          h('button', { class: 'btn primary', onClick: newProjectDialog }, icon('plus'), 'New project'),
          h('button', { class: 'btn', onClick: () => fileInput.click() }, icon('upload'), 'Upload .zip')
        )
      ),
      projects.length || true ? h('div', { class: 'dash-bar' }, search) : null,
      listEl,
      h('footer', { class: 'dash-foot' },
        h('span', null, 'Your projects never leave this device.'),
        h('button', { class: 'link-btn', onClick: exportAll }, 'Back up all projects'),
        h('span', { class: 'dot' }, '·'),
        h('button', { class: 'link-btn', onClick: () => fileInput.click() }, 'Restore from backup'),
        h('span', { class: 'dot' }, '·'),
        h('button', { class: 'link-btn', onClick: showAbout }, 'About')
      ),
      fileInput
    )
  );

  // drag a .zip onto the page to import it
  const onDragOver = (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); };
  const onDrop = async (e) => {
    const f = [...(e.dataTransfer?.files || [])].find((x) => /\.zip$/i.test(x.name));
    if (f) { e.preventDefault(); await doImport(f); }
  };
  root.addEventListener('dragover', onDragOver);
  root.addEventListener('drop', onDrop);

  db.requestPersistence();
  refresh();
  return () => {
    root.removeEventListener('dragover', onDragOver);
    root.removeEventListener('drop', onDrop);
  };
}

export function showAbout() {
  modal({
    title: 'About TeXLab',
    body: [
      h('p', null, 'TeXLab is a static LaTeX editor that runs completely in your browser. Documents are compiled by pdfTeX running as WebAssembly, so there is no server, no account, and nothing is uploaded.'),
      h('p', null, 'Projects are saved in this browser’s IndexedDB. Clearing site data removes them, so use ', h('b', null, 'Back up all projects'), ' or download a project as .zip from time to time.'),
      h('p', { class: 'fine' }, 'Engine: SwiftLaTeX pdfTeX (EPL-2.0 / GPL-2.0 with Classpath exception). TeX Live package files keep their own licences. Editor: CodeMirror 6. Viewer: pdf.js. Engine build and package bundle taken from TeXbrain (MIT).'),
    ],
    actions: [{ label: 'Close', primary: true }],
  });
}
