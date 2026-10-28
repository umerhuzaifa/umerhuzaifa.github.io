// Small UI toolkit: element builder, icons, modal, menu, toast.

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ------------------------------------------------------------------- icons
const P = {
  back: 'M19 12H5M11 18l-6-6 6-6',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5',
  tex: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  folderOpen: 'M3 8V6a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v2M3 8h18l-2 9a2 2 0 0 1-2 1.5H5A2 2 0 0 1 3 17z',
  filePlus: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 11v6M9 14h6',
  folderPlus: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 10v6M9 13h6',
  image: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 16l-5-5-8 8',
  pdf: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M8 16h1.5a1.5 1.5 0 0 0 0-3H8zM8 13v5',
  bib: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  play: 'M7 4.5v15l12-7.5z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  chevR: 'M9 6l6 6-6 6',
  chevD: 'M6 9l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  history: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  numbered: 'M10 6h10M10 12h10M10 18h10M4 5l1-1v4M4 12.5a1 1 0 0 1 2 0c0 1-2 1.5-2 2.5h2M4 17.5h2l-1.2 1.2a1 1 0 1 1-.8 1.5',
  bold: 'M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7.5a3.5 3.5 0 0 1 0 7H7z',
  italic: 'M10 5h8M6 19h8M14 5l-4 14',
  warn: 'M12 4l9.5 16.5h-19zM12 10v4.5M12 17.5h.01',
  err: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  copy: 'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM5 15V5a1 1 0 0 1 1-1h10',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M9 14v6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  sidebar: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM9 5v14',
  fit: 'M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  quote: 'M7 17h3l1-4V7H5v6h3zM16 17h3l1-4V7h-6v6h3z',
  math: 'M5 6h14M5 6l7 6-7 6h14',
  comment: 'M5 4v16M9 8h10M9 12h10M9 16h6',
  zip: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M11 11h2M11 14h2M11 17h2',
  refresh: 'M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4',
  copyfile: 'M8 8h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM4 16V5a1 1 0 0 1 1-1h11',
  star: 'M12 4l2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8z',
  words: 'M4 6h16M4 10h16M4 14h10M4 18h7',
  keyboard: 'M3 7h18a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM6 11h.01M10 11h.01M14 11h.01M18 11h.01M7 14.5h10',
};

export function icon(name, size = 16) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size);
  s.setAttribute('height', size);
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.8');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.classList.add('ic');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', P[name] || P.file);
  s.appendChild(p);
  return s;
}

export function iconBtn(name, title, onClick, cls = '') {
  return h('button', { class: 'icon-btn ' + cls, title, 'aria-label': title, onClick }, icon(name));
}

// ------------------------------------------------------------------- toast
let toastBox;
export function toast(msg, kind = 'info', ms = 3200) {
  if (!toastBox) {
    toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastBox);
  }
  const t = h('div', { class: 'toast ' + kind }, msg);
  toastBox.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, ms);
}

// ------------------------------------------------------------------- modal
export function modal({ title, body, actions = [], wide = false, onClose }) {
  const prevFocus = document.activeElement;
  const overlay = h('div', { class: 'overlay' });
  const dlg = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const close = (result) => {
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
    prevFocus?.focus?.();
    onClose?.(result);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(null); }
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      const primary = actions.find((a) => a.primary);
      if (primary) { e.preventDefault(); primary.onClick?.(close); }
    }
  };
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(null); });

  dlg.append(
    h('div', { class: 'modal-head' }, h('h2', null, title), iconBtn('x', 'Close', () => close(null))),
    h('div', { class: 'modal-body' }, body),
    actions.length
      ? h(
          'div',
          { class: 'modal-foot' },
          actions.map((a) =>
            h('button', { class: 'btn ' + (a.primary ? 'primary' : '') + (a.danger ? ' danger' : ''), onClick: () => (a.onClick ? a.onClick(close) : close(null)) }, a.label)
          )
        )
      : null
  );
  overlay.appendChild(dlg);
  document.body.appendChild(overlay);
  setTimeout(() => (dlg.querySelector('[autofocus], input, textarea, .btn.primary') || dlg).focus?.(), 30);
  return { close, el: dlg };
}

export function askText({ title, label, value = '', ok = 'OK', placeholder = '', select = true }) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'text', class: 'input', value, placeholder, autofocus: true, spellcheck: 'false' });
    let done = false;
    const finish = (v, close) => { if (done) return; done = true; close?.(); resolve(v); };
    const m = modal({
      title,
      body: [label ? h('label', { class: 'field-label' }, label) : null, input],
      actions: [
        { label: 'Cancel', onClick: (c) => finish(null, c) },
        { label: ok, primary: true, onClick: (c) => finish(input.value.trim() || null, c) },
      ],
      onClose: () => finish(null),
    });
    setTimeout(() => {
      input.focus();
      if (select) {
        const dot = value.lastIndexOf('.');
        input.setSelectionRange(0, dot > 0 ? dot : value.length);
      }
    }, 40);
    return m;
  });
}

export function askConfirm({ title, message, ok = 'OK', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v, close) => { if (done) return; done = true; close?.(); resolve(v); };
    modal({
      title,
      body: h('p', { class: 'confirm-msg' }, message),
      actions: [
        { label: 'Cancel', onClick: (c) => finish(false, c) },
        { label: ok, primary: !danger, danger, onClick: (c) => finish(true, c) },
      ],
      onClose: () => finish(false),
    });
  });
}

// -------------------------------------------------------------------- menu
let openMenu = null;
export function closeMenu() {
  if (openMenu) { openMenu.remove(); openMenu = null; }
}

/** items: [{label, icon, onClick, danger, disabled, sep, checked, hint}] */
export function menu(anchor, items, { align = 'left', at } = {}) {
  closeMenu();
  const el = h('div', { class: 'menu', role: 'menu' });
  for (const it of items) {
    if (it.sep) { el.append(h('div', { class: 'menu-sep' })); continue; }
    if (it.header) { el.append(h('div', { class: 'menu-header' }, it.header)); continue; }
    const b = h(
      'button',
      {
        class: 'menu-item' + (it.danger ? ' danger' : ''),
        role: 'menuitem',
        disabled: it.disabled,
        onClick: (e) => { e.stopPropagation(); closeMenu(); it.onClick?.(); },
      },
      it.icon ? icon(it.icon) : h('span', { class: 'ic-space' }),
      h('span', { class: 'menu-label' }, it.label),
      it.checked ? icon('check') : null,
      it.hint ? h('span', { class: 'menu-hint' }, it.hint) : null
    );
    el.append(b);
  }
  document.body.appendChild(el);
  const r = anchor ? anchor.getBoundingClientRect() : { left: at.x, right: at.x, bottom: at.y, top: at.y };
  const mw = el.offsetWidth, mh = el.offsetHeight;
  let x = align === 'right' ? r.right - mw : r.left;
  let y = r.bottom + 4;
  x = Math.max(8, Math.min(x, innerWidth - mw - 8));
  if (y + mh > innerHeight - 8) y = Math.max(8, (anchor ? r.top : y) - mh - (anchor ? 4 : 0));
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  openMenu = el;
  setTimeout(() => {
    const off = (e) => { if (!el.contains(e.target)) { closeMenu(); document.removeEventListener('mousedown', off, true); } };
    document.addEventListener('mousedown', off, true);
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { closeMenu(); document.removeEventListener('keydown', esc); } });
  });
  el.querySelector('.menu-item:not([disabled])')?.focus?.({ preventScroll: true });
  return el;
}

// ------------------------------------------------------------------ format
export function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  if (s < 90) return 'a minute ago';
  const m = Math.round(s / 60);
  if (m < 60) return m + ' minutes ago';
  const hr = Math.round(m / 60);
  if (hr < 24) return hr === 1 ? 'an hour ago' : hr + ' hours ago';
  const d = Math.round(hr / 24);
  if (d < 7) return d === 1 ? 'yesterday' : d + ' days ago';
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function bytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}

export function download(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
