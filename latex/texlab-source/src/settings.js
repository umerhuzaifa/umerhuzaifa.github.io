const KEY = 'texlab.settings.v1';
const DEFAULTS = {
  theme: 'system', // system | light | dark
  fontSize: 14,
  autoCompile: false,
  sidebarWidth: 240,
  editorFraction: 0.5,
  sidebarOpen: true,
};

let cache = null;
export function get() {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

const listeners = new Set();
export function set(patch) {
  cache = { ...get(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
  applyTheme();
  listeners.forEach((fn) => fn(cache));
}
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

const mq = window.matchMedia('(prefers-color-scheme: dark)');
export function effectiveTheme() {
  const t = get().theme;
  return t === 'system' ? (mq.matches ? 'dark' : 'light') : t;
}
export function applyTheme() {
  const root = document.documentElement;
  root.dataset.theme = effectiveTheme();
  root.style.setProperty('--ed-font-size', get().fontSize + 'px');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = effectiveTheme() === 'dark' ? '#14181d' : '#ffffff';
}
mq.addEventListener?.('change', () => get().theme === 'system' && applyTheme());
