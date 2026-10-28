// Continuous-scroll PDF viewer on top of pdf.js. Pages render lazily, keep the
// scroll position across recompiles, and carry a selectable text layer.

import * as pdfjs from 'pdfjs-dist/build/pdf.min.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', document.baseURI).href;

const PAD = 16;

export class PdfViewer {
  constructor(scroller, { onPage, onZoom } = {}) {
    this.scroller = scroller;
    this.onPage = onPage;
    this.onZoom = onZoom;
    this.doc = null;
    this.pages = []; // { el, canvas, text, w, h, state, task }
    this.mode = 'fit'; // 'fit' | number
    this.scale = 1;
    this.container = document.createElement('div');
    this.container.className = 'pdf-pages';
    this.scroller.appendChild(this.container);

    this.io = new IntersectionObserver((entries) => this.#visibility(entries), {
      root: this.scroller,
      rootMargin: '1200px 0px',
    });

    this.ro = new ResizeObserver(() => {
      if (this.mode === 'fit' && this.doc) this.#applyScale(true);
    });
    this.ro.observe(this.scroller);

    this.scroller.addEventListener('scroll', () => this.#updateCurrent(), { passive: true });
    // ctrl/cmd + wheel zooms the PDF instead of the browser page
    this.scroller.addEventListener(
      'wheel',
      (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        this.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
      },
      { passive: false }
    );
  }

  get pageCount() { return this.doc ? this.doc.numPages : 0; }

  async load(data) {
    const task = pdfjs.getDocument({ data: data.slice(), isEvalSupported: false, wasmUrl: new URL('pdfjs/wasm/', document.baseURI).href });
    const doc = await task.promise;
    const keepTop = this.scroller.scrollTop;
    const old = this.doc;
    this.doc = doc;

    const sizes = [];
    const first = await doc.getPage(1);
    const v1 = first.getViewport({ scale: 1 });
    sizes.push([v1.width, v1.height]);
    await Promise.all(
      Array.from({ length: doc.numPages - 1 }, (_, i) =>
        doc.getPage(i + 2).then((p) => {
          const v = p.getViewport({ scale: 1 });
          sizes[i + 1] = [v.width, v.height];
        })
      )
    );

    for (const p of this.pages) { this.io.unobserve(p.el); p.task?.cancel?.(); }
    this.container.textContent = '';
    this.pages = sizes.map(([w, h], i) => {
      const el = document.createElement('div');
      el.className = 'pg';
      el.dataset.page = String(i + 1);
      const canvas = document.createElement('canvas');
      const text = document.createElement('div');
      text.className = 'textLayer';
      el.append(canvas, text);
      this.container.appendChild(el);
      return { el, canvas, text, w, h, state: 'idle', task: null, index: i + 1 };
    });
    this.#applyScale(false);
    this.scroller.scrollTop = keepTop;
    for (const p of this.pages) this.io.observe(p.el);
    this.#updateCurrent();
    if (old) old.destroy().catch(() => {});
  }

  clear() {
    for (const p of this.pages) { this.io.unobserve(p.el); p.task?.cancel?.(); }
    this.pages = [];
    this.container.textContent = '';
    if (this.doc) this.doc.destroy().catch(() => {});
    this.doc = null;
  }

  setMode(mode) {
    this.mode = mode;
    this.#applyScale(true);
  }

  zoomBy(f) {
    const base = this.scale;
    this.mode = Math.min(5, Math.max(0.25, base * f));
    this.#applyScale(true);
  }

  goTo(n) {
    const p = this.pages[Math.min(this.pages.length, Math.max(1, n)) - 1];
    if (p) this.scroller.scrollTop = p.el.offsetTop - PAD;
  }

  get currentPage() { return this._current || 1; }

  #fitScale() {
    if (!this.pages.length) return 1;
    const avail = this.scroller.clientWidth - PAD * 2;
    const widest = Math.max(...this.pages.map((p) => p.w));
    return Math.max(0.2, avail / widest);
  }

  #applyScale(keepPosition) {
    const ratio = keepPosition && this.scroller.scrollHeight ? this.scroller.scrollTop / this.scroller.scrollHeight : null;
    this.scale = this.mode === 'fit' ? this.#fitScale() : this.mode;
    for (const p of this.pages) {
      p.el.style.width = Math.floor(p.w * this.scale) + 'px';
      p.el.style.height = Math.floor(p.h * this.scale) + 'px';
      if (p.state === 'done' || p.state === 'busy') this.#release(p);
    }
    if (ratio !== null) this.scroller.scrollTop = ratio * this.scroller.scrollHeight;
    this.onZoom?.(this.scale, this.mode);
    // anything on screen needs drawing again at the new scale
    for (const p of this.pages) { this.io.unobserve(p.el); this.io.observe(p.el); }
  }

  #visibility(entries) {
    for (const e of entries) {
      const page = this.pages[Number(e.target.dataset.page) - 1];
      if (!page) continue;
      if (e.isIntersecting) this.#render(page);
      else if (page.state === 'done') this.#release(page);
    }
  }

  #release(p) {
    p.task?.cancel?.();
    p.task = null;
    p.canvas.width = p.canvas.height = 0;
    p.text.textContent = '';
    p.state = 'idle';
  }

  async #render(p) {
    if (p.state !== 'idle' || !this.doc) return;
    p.state = 'busy';
    const doc = this.doc;
    const scale = this.scale;
    try {
      const page = await doc.getPage(p.index);
      if (doc !== this.doc || scale !== this.scale) { p.state = 'idle'; return; }
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const viewport = page.getViewport({ scale: scale * dpr });
      const cssView = page.getViewport({ scale });
      const c = p.canvas;
      c.width = Math.floor(viewport.width);
      c.height = Math.floor(viewport.height);
      c.style.width = Math.floor(cssView.width) + 'px';
      c.style.height = Math.floor(cssView.height) + 'px';
      const ctx = c.getContext('2d', { alpha: false });
      p.task = page.render({ canvasContext: ctx, canvas: c, viewport });
      await p.task.promise;
      if (doc !== this.doc || scale !== this.scale) return;

      p.text.style.setProperty('--total-scale-factor', String(scale));
      p.text.style.setProperty('--scale-factor', String(scale));
      p.text.textContent = '';
      const layer = new pdfjs.TextLayer({
        textContentSource: page.streamTextContent(),
        container: p.text,
        viewport: cssView,
      });
      await layer.render();
      p.state = 'done';
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException') console.warn('pdf render', err);
      if (p.state === 'busy') p.state = 'idle';
    }
  }

  #updateCurrent() {
    if (!this.pages.length) return;
    const mid = this.scroller.scrollTop + this.scroller.clientHeight / 3;
    let cur = 1;
    for (const p of this.pages) {
      if (p.el.offsetTop - PAD <= mid) cur = p.index;
      else break;
    }
    if (cur !== this._current) {
      this._current = cur;
      this.onPage?.(cur, this.pages.length);
    }
  }
}
