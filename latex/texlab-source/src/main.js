import * as settings from './settings.js';
import { renderDashboard } from './dashboard.js';
import { openEditor } from './editor-view.js';
import { toast } from './ui.js';

settings.applyTheme();

if ('serviceWorker' in navigator) {
  // sw.js sits next to index.html, so its scope is this folder
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker unavailable:', err));
}

const root = document.getElementById('app');
let cleanup = null;
let token = 0;

async function route() {
  const my = ++token;
  if (cleanup) {
    const c = cleanup;
    cleanup = null;
    try { await c(); } catch (e) { console.warn(e); }
  }
  if (my !== token) return;
  const m = /^#\/p\/([^/?]+)/.exec(location.hash);
  try {
    if (m) {
      const c = await openEditor(root, decodeURIComponent(m[1]));
      if (my !== token) { await c(); return; }
      cleanup = c;
    } else {
      document.title = 'TeXLab · LaTeX editor in your browser';
      cleanup = renderDashboard(root);
    }
  } catch (err) {
    console.error(err);
    toast('Something went wrong: ' + err.message, 'error', 8000);
  }
}

window.addEventListener('hashchange', route);
route();
