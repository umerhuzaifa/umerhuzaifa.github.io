// IndexedDB storage: projects, files, version snapshots.
// Everything stays in the visitor's browser.

const DB_NAME = 'texlab';
const DB_VERSION = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('projects', { keyPath: 'id' });
      const files = db.createObjectStore('files', { keyPath: 'key' });
      files.createIndex('pid', 'pid');
      const versions = db.createObjectStore('versions', { keyPath: 'id', autoIncrement: true });
      versions.createIndex('pid', 'pid');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(stores, mode, fn) {
  const db = await open();
  const t = db.transaction(stores, mode);
  const done = new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
  const result = await fn(...[].concat(stores).map((s) => t.objectStore(s)));
  await done;
  return result;
}

const fkey = (pid, path) => pid + '\u0000' + path;
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// ---- projects -------------------------------------------------------------

export async function listProjects() {
  return tx('projects', 'readonly', (s) => wrap(s.getAll()));
}

export async function getProject(id) {
  return tx('projects', 'readonly', (s) => wrap(s.get(id)));
}

export async function saveProject(p) {
  p.updated = Date.now();
  return tx('projects', 'readwrite', (s) => wrap(s.put(p)));
}

export async function touchProject(id) {
  const p = await getProject(id);
  if (p) await saveProject(p);
}

export async function createProject({ name, main = 'main.tex', files = [] }) {
  const p = { id: uid(), name, main, created: Date.now(), updated: Date.now() };
  await tx(['projects', 'files'], 'readwrite', async (ps, fs) => {
    ps.put(p);
    for (const f of files) fs.put(makeRecord(p.id, f));
  });
  return p;
}

export async function deleteProject(id) {
  await tx(['projects', 'files', 'versions'], 'readwrite', async (ps, fs, vs) => {
    ps.delete(id);
    for (const k of await wrap(fs.index('pid').getAllKeys(id))) fs.delete(k);
    for (const k of await wrap(vs.index('pid').getAllKeys(id))) vs.delete(k);
  });
}

export async function duplicateProject(id, name) {
  const src = await getProject(id);
  const files = await listFiles(id);
  return createProject({ name, main: src.main, files });
}

// ---- files ----------------------------------------------------------------
// record: { key, pid, path, dir, bin, content, updated }
// content is a string for text files and an ArrayBuffer for binary files.

function makeRecord(pid, f) {
  return {
    key: fkey(pid, f.path),
    pid,
    path: f.path,
    dir: !!f.dir,
    bin: !!f.bin,
    content: f.dir ? '' : f.content ?? '',
    updated: Date.now(),
  };
}

export async function listFiles(pid) {
  return tx('files', 'readonly', (s) => wrap(s.index('pid').getAll(pid)));
}

export async function putFile(pid, f) {
  return tx('files', 'readwrite', (s) => wrap(s.put(makeRecord(pid, f))));
}

export async function putFiles(pid, list) {
  return tx('files', 'readwrite', async (s) => {
    for (const f of list) s.put(makeRecord(pid, f));
  });
}

export async function deleteFile(pid, path) {
  // removes the file, or a folder with everything below it
  return tx('files', 'readwrite', async (s) => {
    const all = await wrap(s.index('pid').getAll(pid));
    for (const r of all) {
      if (r.path === path || r.path.startsWith(path + '/')) s.delete(r.key);
    }
  });
}

export async function moveFile(pid, from, to) {
  return tx('files', 'readwrite', async (s) => {
    const all = await wrap(s.index('pid').getAll(pid));
    for (const r of all) {
      if (r.path === from || r.path.startsWith(from + '/')) {
        s.delete(r.key);
        const path = to + r.path.slice(from.length);
        s.put({ ...r, key: fkey(pid, path), path, updated: Date.now() });
      }
    }
  });
}

export async function replaceFiles(pid, list) {
  // used when restoring a version: wipe and write
  return tx('files', 'readwrite', async (s) => {
    for (const k of await wrap(s.index('pid').getAllKeys(pid))) s.delete(k);
    for (const f of list) s.put(makeRecord(pid, f));
  });
}

// ---- versions -------------------------------------------------------------

export async function saveVersion(pid, label, auto = false) {
  const files = await listFiles(pid);
  const rec = {
    pid,
    label,
    auto,
    time: Date.now(),
    files: files.map((f) => ({ path: f.path, dir: f.dir, bin: f.bin, content: f.content })),
  };
  return tx('versions', 'readwrite', (s) => wrap(s.add(rec)));
}

export async function listVersions(pid) {
  const all = await tx('versions', 'readonly', (s) => wrap(s.index('pid').getAll(pid)));
  return all.sort((a, b) => b.time - a.time);
}

export async function deleteVersion(id) {
  return tx('versions', 'readwrite', (s) => wrap(s.delete(id)));
}

export async function pruneAutoVersions(pid, keep = 20) {
  const vs = (await listVersions(pid)).filter((v) => v.auto);
  for (const v of vs.slice(keep)) await deleteVersion(v.id);
}

// ---- misc -----------------------------------------------------------------

export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {}
  return false;
}
