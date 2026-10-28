import JSZip from 'jszip';

export const TEXT_EXT = new Set(
  'tex bib sty cls bst bbx cbx lbx def cfg clo ldf fd txt md csv tsv json ltx dtx ins aux toc bbl tikz pgf gnuplot py r c cpp h js ts sh html xml yaml yml log'.split(' ')
);

export const extOf = (p) => {
  const m = /\.([^./]+)$/.exec(p);
  return m ? m[1].toLowerCase() : '';
};
export const isTextPath = (p) => TEXT_EXT.has(extOf(p)) || !/\./.test(p.split('/').pop());
export const isImagePath = (p) => ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(extOf(p));

const IGNORE = /(^|\/)(__MACOSX|\.git|\.DS_Store|node_modules)(\/|$)|(^|\/)\._/;
const LATEX_JUNK = /\.(aux|log|out|toc|synctex\.gz|fls|fdb_latexmk|blg|lof|lot|nav|snm|vrb)$/i;

/** Build a zip Blob from project file records. */
export async function exportProject(files) {
  const zip = new JSZip();
  for (const f of files) {
    if (f.dir) zip.folder(f.path);
    else zip.file(f.path, f.content, { binary: !!f.bin });
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

/** Read a zip into [{path, bin, content, dir}], stripping a single top-level folder. */
export async function readZip(blobOrBuffer) {
  const zip = await JSZip.loadAsync(blobOrBuffer);
  const entries = [];
  zip.forEach((path, entry) => {
    if (IGNORE.test(path)) return;
    entries.push([path, entry]);
  });
  let prefix = '';
  const tops = new Set(entries.map(([p]) => p.split('/')[0]));
  if (tops.size === 1 && entries.every(([p]) => p.includes('/'))) prefix = [...tops][0] + '/';

  const out = [];
  for (const [path, entry] of entries) {
    const rel = path.slice(prefix.length);
    if (!rel) continue;
    if (entry.dir) { out.push({ path: rel.replace(/\/$/, ''), dir: true }); continue; }
    if (LATEX_JUNK.test(rel) && !/\.bbl$/i.test(rel)) continue;
    if (isTextPath(rel)) {
      let text = await entry.async('string');
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      out.push({ path: rel, bin: false, content: text });
    } else {
      out.push({ path: rel, bin: true, content: await entry.async('arraybuffer') });
    }
  }
  return out;
}

export function guessMain(files) {
  const tex = files.filter((f) => !f.dir && !f.bin && /\.tex$/i.test(f.path));
  const withClass = tex.filter((f) => /\\documentclass/.test(f.content));
  const pool = withClass.length ? withClass : tex;
  const pick =
    pool.find((f) => /^main\.tex$/i.test(f.path)) ||
    pool.sort((a, b) => a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path))[0];
  return pick ? pick.path : 'main.tex';
}

export { JSZip };
