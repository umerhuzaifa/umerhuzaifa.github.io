/* CSC 241 Python Visualizer — UI.
 * Loads Pyodide, runs tracer.py on the student's code, then replays the
 * recorded trace step by step with animated frames, objects and arrows. */
(() => {
  "use strict";

  const CFG = Object.assign(
    { pyodideBase: "https://cdn.jsdelivr.net/npm/pyodide@314.0.7/", maxSteps: 2000 },
    window.PYTUTOR || {}
  );
  const SPEED_MS = [1800, 1200, 750, 420, 200];
  const $ = (id) => document.getElementById(id);
  const el = {
    editor: $("editor"), gutter: $("gutter"), editorWrap: $("editorWrap"), codeView: $("codeView"),
    visualizeBtn: $("visualizeBtn"), editBtn: $("editBtn"), modeHint: $("modeHint"), kbdHint: $("kbdHint"),
    controls: $("controls"), status: $("status"), slider: $("slider"), speed: $("speed"),
    bFirst: $("bFirst"), bBack: $("bBack"), bPlay: $("bPlay"), bFwd: $("bFwd"), bLast: $("bLast"),
    out: $("out"), caption: $("caption"), viz: $("viz"), vizScroll: $("vizScroll"), arrows: $("arrows"),
    framesCol: $("framesCol"), objsCol: $("objsCol"), placeholder: $("placeholder"),
    banner: $("banner"), watchBox: $("watchBox"), watchText: $("watchText"),
    engine: $("engineStatus"), select: $("exampleSelect"), share: $("shareBtn"),
  };

  const state = {
    py: null, runTrace: null, ready: false,
    trace: null, output: "", idx: 0, prevShown: null, mode: "edit",
    timer: null, lastArrows: new Set(), errLine: 0, codeLines: [],
  };

  /* ------------------------------------------------------------ helpers -- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const J = (x) => JSON.stringify(x);

  function showBanner(msg, kind) {
    el.banner.className = "banner" + (kind ? " " + kind : "");
    el.banner.textContent = msg;
    el.banner.hidden = !msg;
  }

  /* ------------------------------------------------- syntax highlighting -- */
  const KW = new Set("False None True and as assert break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield".split(" "));
  const BI = new Set("print input int float str len range list dict set tuple sum min max abs round sorted open bool enumerate zip type isinstance reversed any all".split(" "));
  const TOKEN = /("""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$))|(#[^\n]*)|((?:[rbfRBF]{0,2})(?:"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?))|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|([A-Za-z_]\w*)/g;

  function highlight(code) {
    const segs = [];
    let last = 0, m, afterDef = false;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(code))) {
      if (m.index > last) segs.push(["", code.slice(last, m.index)]);
      let cls = "";
      if (m[1] || m[3]) cls = "t-str";
      else if (m[2]) cls = "t-cm";
      else if (m[4]) cls = "t-num";
      else if (m[5]) {
        if (KW.has(m[5])) cls = "t-kw";
        else if (afterDef) cls = "t-fn";
        else if (BI.has(m[5])) cls = "t-bi";
        afterDef = m[5] === "def" || m[5] === "class";
      }
      if (!m[5]) afterDef = false;
      segs.push([cls, m[0]]);
      last = TOKEN.lastIndex;
      if (m[0].length === 0) TOKEN.lastIndex++;
    }
    if (last < code.length) segs.push(["", code.slice(last)]);
    const lines = [""];
    for (const [cls, text] of segs) {
      const parts = text.split("\n");
      parts.forEach((p, i) => {
        if (i > 0) lines.push("");
        if (p) lines[lines.length - 1] += cls ? `<span class="${cls}">${esc(p)}</span>` : esc(p);
      });
    }
    return lines;
  }

  /* ------------------------------------------------------------- editor -- */
  function updateGutter() {
    const n = el.editor.value.split("\n").length;
    let html = "";
    for (let i = 1; i <= n; i++) {
      html += (i === state.errLine ? `<span class="err">${i}</span>` : i) + "\n";
    }
    el.gutter.innerHTML = html;
    el.gutter.scrollTop = el.editor.scrollTop;
  }
  el.editor.addEventListener("input", () => { state.errLine = 0; showBanner(""); updateGutter(); });
  el.editor.addEventListener("scroll", () => { el.gutter.scrollTop = el.editor.scrollTop; });
  el.editor.addEventListener("keydown", (e) => {
    const ta = el.editor;
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); visualize(); return; }
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      ta.setRangeText("    ", ta.selectionStart, ta.selectionEnd, "end");
      ta.dispatchEvent(new Event("input"));
    } else if (e.key === "Enter" && !e.shiftKey && ta.selectionStart === ta.selectionEnd) {
      const pos = ta.selectionStart;
      const lineStart = ta.value.lastIndexOf("\n", pos - 1) + 1;
      const before = ta.value.slice(lineStart, pos);
      let indent = before.match(/^\s*/)[0];
      if (/:\s*$/.test(before)) indent += "    ";
      e.preventDefault();
      ta.setRangeText("\n" + indent, pos, pos, "end");
      ta.dispatchEvent(new Event("input"));
    }
  });

  /* -------------------------------------------------------------- engine -- */
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("Could not load " + src));
      document.head.appendChild(s);
    });
  }

  async function initEngine() {
    try {
      await loadScript(CFG.pyodideBase + "pyodide.js");
      state.py = await loadPyodide({ indexURL: CFG.pyodideBase });
      let src;
      try {
        const r = await fetch("tracer.py", { cache: "no-cache" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        src = await r.text();
      } catch (e) {
        throw new Error("Could not read tracer.py (" + e.message + "). If you opened index.html straight from disk, " +
          "serve the folder instead, e.g. run  python3 -m http.server  inside it.");
      }
      state.py.runPython(src);
      state.runTrace = state.py.globals.get("run_trace");
      state.ready = true;
      el.engine.textContent = "Python ready ✓";
      el.engine.className = "pill ready";
      el.visualizeBtn.disabled = false;
      if (state.autoRun) { state.autoRun = false; visualize(); }
    } catch (err) {
      el.engine.textContent = "Python failed to load";
      el.engine.className = "pill failed";
      showBanner(err.message);
    }
  }

  const inputCb = (prompt) => {
    const v = window.prompt(prompt || "Input:");
    return v === null ? "\x00EOF" : v;
  };

  /* --------------------------------------------------------- visualizing -- */
  async function visualize() {
    if (!state.ready) return;
    const code = el.editor.value.replace(/\r\n?/g, "\n");
    if (!code.trim()) { showBanner("Type or choose a program first.", "info"); return; }
    stop();
    el.visualizeBtn.disabled = true;
    el.visualizeBtn.textContent = "Running…";
    await new Promise((r) => setTimeout(r, 30));
    let res;
    try {
      res = JSON.parse(state.runTrace(code, inputCb, CFG.maxSteps));
    } catch (e) {
      showBanner("Internal error: " + e.message);
      resetVisualizeBtn();
      return;
    }
    resetVisualizeBtn();
    if (!res.ok) {
      state.errLine = res.error.line || 0;
      updateGutter();
      showBanner(`${res.error.kind} on line ${res.error.line}: ${res.error.msg}`);
      return;
    }
    state.trace = res.trace;
    state.output = res.output;
    state.codeLines = highlight(code);
    state.prevShown = null;
    state.lastArrows = new Set();
    state.idx = 0;

    let msg = "", kind = "";
    if (res.truncated) {
      msg = `Stopped after ${res.trace.length} steps to prevent a possible infinite loop. ` +
            "Check that your loop condition eventually becomes False.";
      kind = "info";
    }
    showBanner(msg, kind);
    el.slider.max = String(res.trace.length - 1);
    buildCodeView();
    setMode("viz");
    render();
  }

  function resetVisualizeBtn() {
    el.visualizeBtn.disabled = !state.ready;
    el.visualizeBtn.textContent = "Visualize execution";
  }

  function setMode(mode) {
    state.mode = mode;
    const viz = mode === "viz";
    el.editorWrap.hidden = viz;
    el.codeView.hidden = !viz;
    el.visualizeBtn.hidden = viz;
    el.kbdHint.hidden = viz;
    el.editBtn.hidden = !viz;
    el.controls.hidden = !viz;
    el.modeHint.textContent = viz ? "Click a line number to jump to it" : "Edit, then press Visualize";
    if (!viz) {
      stop();
      el.framesCol.innerHTML = ""; el.objsCol.innerHTML = ""; el.arrows.innerHTML = "";
      el.placeholder.hidden = false;
      el.out.textContent = "";
      el.caption.querySelector(".cap-main").className = "cap-main";
      el.caption.querySelector(".cap-main").innerHTML = "Press <b>Visualize execution</b> to see your program run one line at a time.";
      el.caption.querySelector(".cap-changes").innerHTML = "";
      updateGutter();
    }
  }

  function buildCodeView() {
    el.codeView.innerHTML = state.codeLines.map((h, i) =>
      `<div class="cl" data-line="${i + 1}"><span class="ptr"></span>` +
      `<span class="ln" title="Jump to the next time line ${i + 1} runs">${i + 1}</span>` +
      `<span class="src">${h || " "}</span></div>`).join("");
  }
  el.codeView.addEventListener("click", (e) => {
    const ln = e.target.closest(".ln");
    if (!ln) return;
    const line = +ln.parentElement.dataset.line;
    const n = state.trace.length;
    for (let k = 1; k <= n; k++) {
      const i = (state.idx + k) % n;
      if (state.trace[i].line === line && state.trace[i].ev !== "done") { stop(); go(i); return; }
    }
  });

  /* ------------------------------------------------------------ playback -- */
  function go(i) {
    if (!state.trace) return;
    state.idx = Math.max(0, Math.min(state.trace.length - 1, i));
    render();
  }
  function stop() {
    if (state.timer) { clearTimeout(state.timer); state.timer = null; }
    el.bPlay.textContent = "▶ Play";
  }
  function tick() {
    if (state.idx >= state.trace.length - 1) { stop(); return; }
    go(state.idx + 1);
    state.timer = setTimeout(tick, SPEED_MS[+el.speed.value - 1]);
  }
  function togglePlay() {
    if (state.timer) { stop(); return; }
    if (state.idx >= state.trace.length - 1) go(0);
    el.bPlay.textContent = "❚❚ Pause";
    state.timer = setTimeout(tick, 250);
  }

  el.visualizeBtn.addEventListener("click", visualize);
  el.editBtn.addEventListener("click", () => { state.trace = null; showBanner(""); setMode("edit"); });
  el.bFirst.addEventListener("click", () => { stop(); go(0); });
  el.bBack.addEventListener("click", () => { stop(); go(state.idx - 1); });
  el.bFwd.addEventListener("click", () => { stop(); go(state.idx + 1); });
  el.bLast.addEventListener("click", () => { stop(); go(state.trace.length - 1); });
  el.bPlay.addEventListener("click", togglePlay);
  el.slider.addEventListener("input", () => { stop(); go(+el.slider.value); });
  document.addEventListener("keydown", (e) => {
    if (state.mode !== "viz" || /^(TEXTAREA|INPUT|SELECT)$/.test((e.target.tagName || ""))) return;
    if (e.key === "ArrowRight") { e.preventDefault(); stop(); go(state.idx + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); stop(); go(state.idx - 1); }
    else if (e.key === "Home") { e.preventDefault(); stop(); go(0); }
    else if (e.key === "End") { e.preventDefault(); stop(); go(state.trace.length - 1); }
    else if (e.key === " ") { e.preventDefault(); togglePlay(); }
  });

  /* ------------------------------------------------- diffing two steps -- */
  function objCells(o) {
    if (o.items) return o.items.map((e, i) => [String(i), e]);
    if (o.pairs) return o.pairs.map(([k, v]) => [J(k), v]);
    if (o.attrs) return o.attrs.map(([k, v]) => [k, v]);
    return [];
  }
  function flat(step) {
    const m = new Map(), v = new Map();
    for (const [k, e] of step.globals) { m.set("G|" + k, J(e)); v.set("G|" + k, { label: k, e }); }
    for (const f of step.stack) {
      m.set("F" + f.fn, "1");
      for (const [k, e] of f.locals) {
        const key = "F" + f.fn + "|" + k;
        m.set(key, J(e)); v.set(key, { label: `${k} (in ${f.name})`, e });
      }
    }
    for (const id in step.heap) {
      m.set("H" + id, "1");
      for (const [k, e] of objCells(step.heap[id])) m.set("H" + id + "|" + k, J(e));
    }
    return { m, v };
  }

  function pyText(e, heap, depth = 0) {
    if (e[0] === "p") return e[2];
    const o = heap[e[1]];
    if (!o) return "…";
    if (depth > 1) return o.t === "list" ? "[…]" : o.t === "dict" ? "{…}" : "…";
    const take = (arr, f) => {
      const parts = arr.slice(0, 6).map(f);
      if (arr.length > 6 || o.more) parts.push("…");
      return parts.join(", ");
    };
    switch (o.t) {
      case "list": return "[" + take(o.items, (x) => pyText(x, heap, depth + 1)) + "]";
      case "tuple": return "(" + take(o.items, (x) => pyText(x, heap, depth + 1)) + (o.items.length === 1 ? ",)" : ")");
      case "set": case "frozenset": return o.items.length ? "{" + take(o.items, (x) => pyText(x, heap, depth + 1)) + "}" : "set()";
      case "dict": return "{" + take(o.pairs, ([k, x]) => pyText(k, heap, depth + 1) + ": " + pyText(x, heap, depth + 1)) + "}";
      case "function": return `function ${o.name}`;
      case "instance": return `${o.cls} object`;
      case "class": return `class ${o.name}`;
      default: return o.text || o.t;
    }
  }

  function refName(step, id) {
    for (const [k, e] of step.globals) if (e[0] === "r" && e[1] === id) return k;
    for (const f of step.stack) for (const [k, e] of f.locals) if (e[0] === "r" && e[1] === id) return k;
    return null;
  }

  function describe(step, prev) {
    const items = [];
    const code = (s) => `<code>${esc(s)}</code>`;
    if (prev) {
      const cur = flat(step), pv = flat(prev);
      for (const f of step.stack) {
        if (!pv.m.has("F" + f.fn)) {
          const args = f.locals.map(([k, e]) => `${k}=${pyText(e, step.heap)}`).join(", ");
          items.push(`New frame <b>${esc(f.name)}</b>(${esc(args)})`);
        }
      }
      for (const [key, { label, e }] of cur.v) {
        const before = pv.v.get(key);
        const shown = pyText(e, step.heap);
        if (!before) { if (!/^F/.test(key) || pv.m.has(key.split("|")[0])) items.push(`${code(label)} = ${code(shown)} <i>(new)</i>`); }
        else if (J(before.e) !== J(e)) items.push(`${code(label)}: ${code(pyText(before.e, prev.heap))} → ${code(shown)}`);
      }
      for (const id in step.heap) {
        const o = step.heap[id];
        if (pv.m.has("H" + id)) {
          const same = objCells(o).every(([k, e]) => pv.m.get("H" + id + "|" + k) === J(e)) &&
                       objCells(prev.heap[id] || {}).length === objCells(o).length;
          if (!same) {
            const nm = refName(step, +id);
            items.push(`${nm ? code(nm) : "an object"} <i>(${esc(o.t)})</i> changed → ${code(pyText(["r", +id], step.heap))}`);
          }
        }
      }
      const gone = prev.stack.filter((f) => !step.stack.some((g) => g.fn === f.fn));
      for (const f of gone) items.push(`Frame <b>${esc(f.name)}</b> finished and was removed`);
    }
    if (items.length > 5) { const extra = items.length - 5; items.length = 5; items.push(`…and ${extra} more`); }
    return items;
  }

  /* ------------------------------------------------------------ rendering -- */
  function render() {
    const step = state.trace[state.idx], prev = state.prevShown;
    const n = state.trace.length;
    el.slider.value = String(state.idx);
    el.bBack.disabled = el.bFirst.disabled = state.idx === 0;
    el.bFwd.disabled = el.bLast.disabled = state.idx === n - 1;
    el.status.textContent = `Step ${state.idx + 1} of ${n}`;
    el.placeholder.hidden = true;

    // code pane markers
    const prevLine = state.idx > 0 ? state.trace[state.idx - 1].line : 0;
    const shownPrev = step.ev === "done" ? step.line : prevLine;
    el.codeView.querySelectorAll(".cl").forEach((row) => {
      const ln = +row.dataset.line;
      row.classList.toggle("cur", ln === step.line && step.ev !== "done");
      row.classList.toggle("prev", ln === shownPrev && ln !== 0);
      row.classList.toggle("err", ln === step.line && (step.ev === "exception" || step.ev === "uncaught"));
    });
    const curRow = el.codeView.querySelector(`.cl[data-line="${step.line}"]`);
    if (curRow) {
      const top = curRow.offsetTop, h = curRow.offsetHeight, v = el.codeView;
      if (top < v.scrollTop + 10) v.scrollTop = Math.max(0, top - 40);
      else if (top + h > v.scrollTop + v.clientHeight - 10) v.scrollTop = top - v.clientHeight + h + 40;
    }

    renderOutput(step, prev);
    renderCaption(step, prev);
    renderViz(step, prev);
    state.prevShown = step;
  }

  function renderOutput(step, prev) {
    const text = state.output.slice(0, step.out);
    const from = prev && prev.out < step.out && state.trace.indexOf(prev) < state.idx ? prev.out : step.out;
    el.out.innerHTML = esc(text.slice(0, from)) + (from < step.out ? `<span class="newout">${esc(text.slice(from))}</span>` : "");
    el.out.scrollTop = el.out.scrollHeight;
  }

  function renderCaption(step, prev) {
    const main = el.caption.querySelector(".cap-main"), ch = el.caption.querySelector(".cap-changes");
    main.className = "cap-main";
    const topName = step.stack.length ? step.stack[step.stack.length - 1].name : null;
    switch (step.ev) {
      case "line": main.textContent = `Next to run: line ${step.line}` + (topName ? ` (inside ${topName})` : ""); break;
      case "return": {
        const f = step.stack[step.stack.length - 1];
        main.textContent = `Line ${step.line}: ${f ? f.name + "()" : "function"} is returning ${pyText(step.ret, step.heap)}`; break;
      }
      case "exception": main.className = "cap-main err"; main.textContent = "⚠ Exception raised: " + step.exc; break;
      case "uncaught": main.className = "cap-main err"; main.textContent = "⚠ Uncaught exception on line " + step.line + ": " + step.exc + " — the program stops here."; break;
      case "done": main.className = "cap-main ok"; main.textContent = "✓ Program finished."; break;
    }
    const items = describe(step, prev && prev !== step ? prev : null);
    ch.innerHTML = items.length ? "<b>Just changed:</b> " + items.join(" &nbsp;·&nbsp; ") : "";
  }

  function renderViz(step, prev) {
    const cur = flat(step), pv = prev ? flat(prev) : null;
    const flashCls = (key) => {
      if (!pv) return "";
      const p = pv.m.get(key);
      return p === undefined || p !== cur.m.get(key) ? " flash" : "";
    };
    const val = (e, key) => e[0] === "p"
      ? `<span class="prim p-${esc(e[1])}" title="${esc(e[1])}">${esc(e[2])}</span>`
      : `<span class="dot" data-k="${esc(key)}" data-t="${e[1]}"></span>`;

    // frames
    let html = "";
    const varsTable = (rows, prefix) => rows.length
      ? `<table class="vars">` + rows.map(([k, e]) =>
          `<tr><td class="vn">${esc(k)}</td><td class="vv${flashCls(prefix + "|" + k)}">${val(e, prefix + "|" + k)}</td></tr>`).join("") + `</table>`
      : `<div class="empty-note">no variables yet</div>`;
    html += `<div class="frame global${step.stack.length ? "" : " current"}"><div class="frame-title">Global frame</div>${varsTable(step.globals, "G")}</div>`;
    for (const f of step.stack) {
      const born = pv && !pv.m.has("F" + f.fn) ? " born" : "";
      const pfx = "F" + f.fn;
      let ret = "";
      if (f.top && step.ev === "return") {
        ret = `<div class="retrow">Return value <span class="vv">${val(step.ret, "RET")}</span></div>`;
      }
      html += `<div class="frame${f.top ? " current" : ""}${born}"><div class="frame-title"><span>${esc(f.name)}</span><span class="tag">frame f${f.fn}</span></div>` +
              varsTable(f.locals, pfx) + ret + `</div>`;
    }
    el.framesCol.innerHTML = html;

    // objects
    let oh = "";
    const ids = Object.keys(step.heap).map(Number).sort((a, b) => a - b);
    for (const id of ids) {
      const o = step.heap[id];
      const born = pv && !pv.m.has("H" + id) ? " born" : "";
      const hk = "H" + id;
      const cell = (k, e, label) =>
        `<div class="cell"><div class="idx">${label === null ? "&nbsp;" : esc(label)}</div><div class="cv${flashCls(hk + "|" + k)}">${val(e, hk + "|" + k)}</div></div>`;
      let body = "", label = o.t;
      if (o.items) {
        const isSeq = o.t !== "set" && o.t !== "frozenset";
        body = o.items.length
          ? `<div class="cells">` + o.items.map((e, i) => cell(String(i), e, isSeq ? String(i) : null)).join("") +
            (o.more ? `<span class="more">… +${o.more} more</span>` : "") + `</div>`
          : `<div class="empty">empty</div>`;
        if (!isSeq) label = o.t;
      } else if (o.pairs) {
        body = o.pairs.length
          ? `<table>` + o.pairs.map(([k, v]) => {
              const kk = J(k);
              return `<tr><td class="dk">${val(k, hk + "|" + kk + "#k")}</td><td class="dv${flashCls(hk + "|" + kk)}">${val(v, hk + "|" + kk)}</td></tr>`;
            }).join("") + `</table>` + (o.more ? `<div class="more">… +${o.more} more</div>` : "")
          : `<div class="empty">empty</div>`;
      } else if (o.t === "function") {
        label = "function"; body = `<div class="fn-sig">${esc(o.name)}(${esc(o.params)})</div>`;
      } else if (o.attrs) {
        label = o.t === "class" ? "class " + o.name : o.cls + " instance";
        body = o.attrs.length
          ? `<table>` + o.attrs.map(([k, v]) =>
              `<tr><td class="an">${esc(k)}</td><td class="av${flashCls(hk + "|" + k)}">${val(v, hk + "|" + k)}</td></tr>`).join("") + `</table>`
          : `<div class="empty">no attributes</div>`;
      } else {
        label = o.type; body = `<div class="plain">${esc(o.text)}</div>`;
      }
      const cls = (o.t === "function" ? " fn" : "") + (o.t === "set" || o.t === "frozenset" ? " set" : "");
      oh += `<div class="obj${cls}${born}" id="obj-${id}"><div class="obj-label">${esc(label)}</div>${body}</div>`;
    }
    el.objsCol.innerHTML = oh;
    requestAnimationFrame(() => drawArrows(true));
  }

  /* --------------------------------------------------------------- arrows -- */
  function offsetIn(node, container) {
    let x = 0, y = 0;
    while (node && node !== container) { x += node.offsetLeft; y += node.offsetTop; node = node.offsetParent; }
    return { x, y };
  }

  function drawArrows(animate) {
    const viz = el.viz, svg = el.arrows;
    svg.setAttribute("width", viz.scrollWidth);
    svg.setAttribute("height", viz.scrollHeight);
    let html = "";
    const seen = new Set();
    viz.querySelectorAll(".dot").forEach((dot) => {
      const t = viz.querySelector("#obj-" + dot.dataset.t);
      if (!t) return;
      const key = dot.dataset.k + ">" + dot.dataset.t;
      seen.add(key);
      const d = offsetIn(dot, viz), o = offsetIn(t, viz);
      const sx = d.x + dot.offsetWidth / 2, sy = d.y + dot.offsetHeight / 2;
      const tx = o.x - 3, ty = o.y + Math.min(18, t.offsetHeight / 2);
      const dx = tx - sx;
      const k = dx > 40 ? Math.min(dx / 2, 90) : 55;
      const c1x = sx + k, c1y = sy, c2x = tx - k, c2y = ty;
      const path = `M${sx},${sy} C${c1x},${c1y} ${c2x},${c2y} ${tx},${ty}`;
      let ax = tx - c2x, ay = ty - c2y;
      const len = Math.hypot(ax, ay) || 1; ax /= len; ay /= len;
      const px = -ay, py = ax, s = 9, w = 5;
      const head = `M${tx},${ty} L${tx - ax * s + px * w},${ty - ay * s + py * w} L${tx - ax * s - px * w},${ty - ay * s - py * w} Z`;
      const isNew = animate && !state.lastArrows.has(key);
      const ret = dot.dataset.k === "RET" ? " ret" : "";
      html += `<g class="arrow${isNew ? " anim" : ""}${ret}"><path class="shaft" d="${path}"${isNew ? ' data-draw="1"' : ""}/><path class="head" d="${head}"/></g>`;
    });
    svg.innerHTML = html;
    svg.querySelectorAll('path[data-draw]').forEach((p) => {
      const L = p.getTotalLength();
      p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
    });
    if (animate) state.lastArrows = seen;
  }
  window.addEventListener("resize", () => { if (state.trace) drawArrows(false); });
  if (window.ResizeObserver) new ResizeObserver(() => { if (state.trace) drawArrows(false); }).observe(el.framesCol);

  /* ------------------------------------------------------ examples/sharing -- */
  function fillExamples() {
    const frag = document.createDocumentFragment();
    const blank = document.createElement("option");
    blank.value = ""; blank.textContent = "— choose an example —"; frag.appendChild(blank);
    for (const g of EXAMPLES) {
      const og = document.createElement("optgroup"); og.label = g.group;
      for (const it of g.items) {
        const o = document.createElement("option"); o.value = it.id; o.textContent = it.title; og.appendChild(o);
      }
      frag.appendChild(og);
    }
    el.select.appendChild(frag);
  }
  const findExample = (id) => { for (const g of EXAMPLES) for (const it of g.items) if (it.id === id) return it; return null; };

  function loadExample(id, autorun) {
    const ex = findExample(id);
    if (!ex) return;
    el.select.value = id;
    el.editor.value = ex.code;
    state.errLine = 0; showBanner("");
    el.watchText.textContent = ex.watch; el.watchBox.hidden = false;
    state.trace = null; setMode("edit"); updateGutter();
    if (autorun) { if (state.ready) visualize(); else state.autoRun = true; }
  }
  el.select.addEventListener("change", () => { if (el.select.value) loadExample(el.select.value, true); });

  const b64 = {
    enc: (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    dec: (s) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/")))),
  };
  el.share.addEventListener("click", async () => {
    const url = location.origin + location.pathname + "#code=" + b64.enc(el.editor.value);
    try { await navigator.clipboard.writeText(url); el.share.textContent = "Link copied ✓"; }
    catch (e) { window.prompt("Copy this link:", url); }
    setTimeout(() => { el.share.textContent = "Copy link"; }, 1800);
  });

  /* ---------------------------------------------------------------- start -- */
  function start() {
    const q = new URLSearchParams(location.search);
    if (q.get("embed") === "1") document.body.classList.add("embed");
    fillExamples();
    const hash = location.hash.match(/^#code=(.+)$/);
    if (hash) {
      try { el.editor.value = b64.dec(hash[1]); state.autoRun = true; } catch (e) { /* ignore bad link */ }
    } else if (q.get("example") && findExample(q.get("example"))) {
      loadExample(q.get("example"), true);
    } else {
      loadExample("list-alias", false);
    }
    updateGutter();
    initEngine();
  }
  start();
})();
