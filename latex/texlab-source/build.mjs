// Builds the static site into ./dist (copy that folder to GitHub Pages).
import { build } from 'esbuild';
import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';

const stamp = Date.now().toString(36);
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

await build({
  entryPoints: { app: 'src/main.js' },
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
});

await cp('public', 'dist', { recursive: true });
let sw = await readFile('dist/sw.js', 'utf8');
await writeFile('dist/sw.js', sw.replace('__BUILD__', stamp));

await cp('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'dist/pdf.worker.min.mjs');
await cp('node_modules/pdfjs-dist/wasm', 'dist/pdfjs/wasm', { recursive: true });
await cp('vendor/swiftlatex', 'dist/swiftlatex', { recursive: true });
if (!process.argv.includes('--no-bundle')) {
  await cp('vendor/texlive', 'dist/texlive', { recursive: true });
}
await cp('vendor/LICENSE-texbrain.txt', 'dist/LICENSES.txt');
console.log('built dist/ (' + stamp + ')');
