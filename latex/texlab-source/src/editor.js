// CodeMirror 6 editor with LaTeX highlighting, completion and error markers.

import { EditorState, EditorSelection } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, dropCursor, highlightSpecialChars, rectangularSelection,
} from '@codemirror/view';
import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
import { StreamLanguage, syntaxHighlighting, HighlightStyle, bracketMatching, indentOnInput, indentUnit } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap, snippetCompletion } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { setDiagnostics, lintGutter } from '@codemirror/lint';
import { tags as t } from '@lezer/highlight';

// ------------------------------------------------------------------ theming
// All colours come from CSS variables, so switching light/dark needs no
// reconfiguration of the editor.

const highlight = HighlightStyle.define([
  { tag: [t.comment, t.lineComment], color: 'var(--tok-comment)', fontStyle: 'italic' },
  { tag: [t.tagName, t.keyword, t.operatorKeyword], color: 'var(--tok-command)' },
  { tag: [t.atom, t.variableName, t.special(t.variableName)], color: 'var(--tok-arg)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--tok-math)' },
  { tag: [t.number, t.integer, t.float], color: 'var(--tok-number)' },
  { tag: [t.bracket, t.brace, t.paren, t.squareBracket], color: 'var(--tok-bracket)' },
  { tag: [t.meta, t.className, t.typeName], color: 'var(--tok-env)' },
  { tag: t.invalid, color: 'var(--danger)' },
]);

const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--ed-bg)', color: 'var(--ed-fg)', fontSize: 'var(--ed-font-size, 14px)' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.6', overflow: 'auto' },
  '.cm-content': { caretColor: 'var(--ed-caret)', padding: '8px 0 40vh' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ed-caret)', borderLeftWidth: '2px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-gutters': { backgroundColor: 'var(--ed-gutter-bg)', color: 'var(--ed-gutter-fg)', border: 'none', borderRight: '1px solid var(--line)' },
  '.cm-activeLine': { backgroundColor: 'var(--ed-active-line)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--ed-active-line)', color: 'var(--fg)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--ed-selection) !important' },
  '.cm-matchingBracket': { backgroundColor: 'var(--ed-match)', outline: '1px solid var(--accent)' },
  '.cm-selectionMatch': { backgroundColor: 'var(--ed-match)' },
  '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy var(--danger)', textUnderlineOffset: '3px' },
  '.cm-lintRange-warning': { backgroundImage: 'none', textDecoration: 'underline wavy var(--warn)', textUnderlineOffset: '3px' },
  '.cm-lint-marker-error': { content: 'none' },
  '.cm-panels': { backgroundColor: 'var(--panel)', color: 'var(--fg)', borderColor: 'var(--line)' },
  '.cm-panels-bottom': { borderTop: '1px solid var(--line)' },
  '.cm-panel.cm-search': { padding: '8px 10px', fontFamily: 'var(--sans)', fontSize: '12.5px' },
  '.cm-panel.cm-search input, .cm-panel.cm-search button': { font: 'inherit' },
  '.cm-tooltip': { backgroundColor: 'var(--panel)', color: 'var(--fg)', border: '1px solid var(--line)', borderRadius: '8px', boxShadow: 'var(--shadow)' },
  '.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--mono)', fontSize: '12.5px', maxHeight: '260px' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'var(--accent-soft)', color: 'var(--fg)' },
  '.cm-completionDetail': { fontFamily: 'var(--sans)', fontStyle: 'normal', opacity: '0.6', marginLeft: '1em' },
  '.cm-tooltip.cm-tooltip-lint': { fontFamily: 'var(--sans)', fontSize: '12.5px' },
});

// ----------------------------------------------------------- completion data

const GREEK = 'alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi pi varpi rho sigma tau upsilon phi varphi chi psi omega Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega'.split(' ');
const SIMPLE = (
  'maketitle tableofcontents listoffigures listoftables newpage clearpage noindent centering raggedright raggedleft hline toprule midrule bottomrule ' +
  'item today LaTeX TeX ldots cdots vdots ddots cdot times div pm mp leq geq neq approx equiv sim simeq propto infty partial nabla forall exists in notin subset subseteq supset cup cap emptyset ' +
  'rightarrow Rightarrow leftarrow Leftarrow leftrightarrow Leftrightarrow mapsto to implies iff land lor neg quad qquad hfill vfill bigskip medskip smallskip ' +
  'left right sin cos tan log ln exp lim max min sup inf det dim ker deg gcd Pr arg sum prod int oint bigcup bigcap ' +
  'large Large LARGE huge Huge small footnotesize scriptsize tiny normalsize bfseries itshape ttfamily rmfamily sffamily scshape mdseries upshape ' +
  'tiny appendix frontmatter mainmatter backmatter printbibliography and'
).split(' ');

const ARG1 = (
  'textbf textit texttt textsc textsf textrm textsl textup emph underline section subsection subsubsection paragraph subparagraph chapter part ' +
  'label ref eqref pageref autoref cref Cref nameref cite citep citet citeauthor citeyear footnote caption title author date thanks input include subfile ' +
  'mathbb mathcal mathbf mathrm mathit mathsf mathtt mathfrak boldsymbol bm overline underline hat bar vec tilde dot ddot widehat widetilde sqrt text operatorname ' +
  'url nolinkurl textcolor color pagecolor texorpdfstring bibliographystyle bibliography addbibresource geometry pagestyle thispagestyle documentclass ' +
  'fbox mbox vphantom hphantom phantom lstinputlisting includepdf'
).split(' ');

const CMD_SNIPPETS = [
  ['\\frac', '\\frac{${}}{${}}', 'fraction'],
  ['\\dfrac', '\\dfrac{${}}{${}}', 'display fraction'],
  ['\\binom', '\\binom{${}}{${}}', 'binomial'],
  ['\\sqrt', '\\sqrt{${}}', 'square root'],
  ['\\sum', '\\sum_{${i=1}}^{${n}} ${}', 'sum'],
  ['\\prod', '\\prod_{${i=1}}^{${n}} ${}', 'product'],
  ['\\int', '\\int_{${a}}^{${b}} ${}\\,d${x}', 'integral'],
  ['\\lim', '\\lim_{${x \\to \\infty}} ${}', 'limit'],
  ['\\includegraphics', '\\includegraphics[width=${0.8}\\linewidth]{${}}', 'insert image'],
  ['\\usepackage', '\\usepackage{${}}', 'load a package'],
  ['\\newcommand', '\\newcommand{\\${name}}[${1}]{${}}', 'define a command'],
  ['\\renewcommand', '\\renewcommand{\\${name}}{${}}', 'redefine a command'],
  ['\\newtheorem', '\\newtheorem{${theorem}}{${Theorem}}', 'define a theorem'],
  ['\\setlength', '\\setlength{\\${parindent}}{${0pt}}', 'set a length'],
  ['\\href', '\\href{${url}}{${text}}', 'hyperlink'],
  ['\\hspace', '\\hspace{${1em}}', 'horizontal space'],
  ['\\vspace', '\\vspace{${1em}}', 'vertical space'],
  ['\\multicolumn', '\\multicolumn{${2}}{${c}}{${}}', 'merge columns'],
  ['\\multirow', '\\multirow{${2}}{*}{${}}', 'merge rows'],
  ['\\xrightarrow', '\\xrightarrow{${}}', 'arrow with label'],
];

const ENVS = {
  itemize: '\\item ${}',
  enumerate: '\\item ${}',
  description: '\\item[${}] ',
  equation: '${}',
  'equation*': '${}',
  align: '${} &= ${} \\\\\n\t&= ${}',
  'align*': '${} &= ${} \\\\\n\t&= ${}',
  gather: '${}',
  multline: '${}',
  cases: '${} & \\text{if } ${} \\\\\n\t${} & \\text{otherwise}',
  matrix: '${} & ${} \\\\\n\t${} & ${}',
  pmatrix: '${} & ${} \\\\\n\t${} & ${}',
  bmatrix: '${} & ${} \\\\\n\t${} & ${}',
  figure: '\\centering\n\t\\includegraphics[width=0.8\\linewidth]{${}}\n\t\\caption{${}}\n\t\\label{fig:${}}',
  table: '\\centering\n\t\\caption{${}}\n\t\\label{tab:${}}\n\t\\begin{tabular}{${ll}}\n\t\t\\hline\n\t\t${} & ${} \\\\\n\t\t\\hline\n\t\\end{tabular}',
  tabular: '\\hline\n\t${} & ${} \\\\\n\t\\hline',
  center: '${}',
  flushleft: '${}',
  flushright: '${}',
  quote: '${}',
  quotation: '${}',
  verbatim: '${}',
  abstract: '${}',
  document: '${}',
  minipage: '${}',
  theorem: '${}',
  lemma: '${}',
  proof: '${}',
  definition: '${}',
  corollary: '${}',
  proposition: '${}',
  remark: '${}',
  example: '${}',
  frame: '\\frametitle{${}}\n\t${}',
  block: '${}',
  columns: '\\column{0.5\\textwidth}\n\t${}',
  tikzpicture: '\\draw (0,0) -- (1,1);',
  lstlisting: '${}',
  thebibliography: '\\bibitem{${}} ${}',
  split: '${}',
  subequations: '${}',
  wrapfigure: '${}',
  algorithm: '\\caption{${}}\n\t\\begin{algorithmic}\n\t\t${}\n\t\\end{algorithmic}',
  algorithmic: '${}',
};

const PACKAGES = (
  'amsmath amssymb amsthm amsfonts graphicx hyperref geometry xcolor color tikz pgfplots pgf booktabs array tabularx longtable multirow multicol subcaption subfig caption float ' +
  'enumitem fancyhdr titlesec titling natbib biblatex babel inputenc fontenc lmodern times mathptmx palatino helvet courier microtype setspace listings algorithm algpseudocode ' +
  'algorithmic siunitx cleveref url csquotes todonotes soul ulem tcolorbox mathtools bm xspace etoolbox ifthen calc lipsum textcomp wrapfig changepage appendix verbatim ' +
  'epsfig epstopdf adjustbox xparse expl3 xkeyval kvoptions trimspace textpos eso-pic everypage placeins afterpage pdfpages rotating lscape pdflscape threeparttable ' +
  'makeidx glossaries nomencl cite hypcap bookmark tocloft parskip indentfirst ragged2e blindtext mwe tikz-cd chemfig mhchem physics braket cancel stmaryrd dsfont ' +
  'fullpage anysize authblk abstract footmisc endnotes paralist mdframed framed marvosym pifont fontawesome5 beamerposter'
).split(' ');

const CLASSES = 'article report book letter beamer memoir scrartcl scrreprt scrbook amsart amsbook IEEEtran standalone minimal slides'.split(' ');

function buildCommandOptions() {
  const out = [];
  for (const [label, tpl, detail] of CMD_SNIPPETS) out.push(snippetCompletion(tpl, { label, detail, type: 'function', boost: 1 }));
  const taken = new Set(CMD_SNIPPETS.map((c) => c[0]));
  for (const n of ARG1) { const l = '\\' + n; if (!taken.has(l)) out.push(snippetCompletion(`\\${n}{\${}}`, { label: l, type: 'function' })); }
  for (const n of SIMPLE) out.push({ label: '\\' + n, type: 'keyword' });
  for (const n of GREEK) out.push({ label: '\\' + n, type: 'constant', detail: 'greek' });
  out.push(snippetCompletion('\\begin{${env}}\n\t${}\n\\end{${env}}', { label: '\\begin', detail: 'environment', type: 'function', boost: 2 }));
  out.push({ label: '\\end', type: 'function' });
  for (const env of Object.keys(ENVS)) {
    out.push(snippetCompletion(`\\begin{${env}}\n\t${ENVS[env]}\n\\end{${env}}`, { label: `\\begin{${env}}`, type: 'class', boost: -1 }));
  }
  return out;
}

const COMMANDS = buildCommandOptions();

export function latexCompletions(getters) {
  return (ctx) => {
    // \cite{...}, \ref{...} and friends: complete from the project
    let m = ctx.matchBefore(/\\[A-Za-z]*cite[A-Za-z]*\*?(?:\[[^\]]*\]){0,2}\{[^}]*$/);
    if (m) {
      const from = m.from + Math.max(m.text.lastIndexOf('{'), m.text.lastIndexOf(',')) + 1;
      const typed = ctx.state.sliceDoc(from, ctx.pos).trimStart();
      return {
        from: ctx.pos - typed.length,
        options: getters.cites().map((c) => ({ label: c.key, detail: c.detail, type: 'text' })),
        validFor: /^[^,}\s]*$/,
      };
    }
    m = ctx.matchBefore(/\\(?:[A-Za-z]*ref|[a-z]*Cref|nameref|vref|pageref|autoref)\*?\{[^}]*$/);
    if (m) {
      const from = m.from + m.text.lastIndexOf('{') + 1;
      return { from, options: getters.labels().map((l) => ({ label: l, type: 'text' })), validFor: /^[^}\s]*$/ };
    }
    m = ctx.matchBefore(/\\begin\{[A-Za-z*]*$/);
    if (m) {
      const from = m.from + m.text.indexOf('{') + 1;
      return {
        from,
        options: Object.keys(ENVS).map((env) => ({
          label: env,
          type: 'class',
          apply: (view, _c, f, to) => {
            const next = view.state.sliceDoc(to, to + 1) === '}' ? to + 1 : to;
            const line = view.state.doc.lineAt(f);
            const indent = /^\s*/.exec(line.text)[0];
            const insert = `${env}}\n${indent}\t\n${indent}\\end{${env}}`;
            view.dispatch({
              changes: { from: f, to: next, insert },
              selection: { anchor: f + env.length + 2 + indent.length + 1 },
              userEvent: 'input.complete',
            });
          },
        })),
        validFor: /^[A-Za-z*]*$/,
      };
    }
    m = ctx.matchBefore(/\\end\{[A-Za-z*]*$/);
    if (m) {
      const from = m.from + m.text.indexOf('{') + 1;
      return { from, options: Object.keys(ENVS).map((label) => ({ label, type: 'class' })), validFor: /^[A-Za-z*]*$/ };
    }
    m = ctx.matchBefore(/\\usepackage(?:\[[^\]]*\])?\{[^}]*$/);
    if (m) {
      const from = m.from + Math.max(m.text.lastIndexOf('{'), m.text.lastIndexOf(',')) + 1;
      return { from, options: PACKAGES.map((label) => ({ label, type: 'namespace' })), validFor: /^[\w-]*$/ };
    }
    m = ctx.matchBefore(/\\documentclass(?:\[[^\]]*\])?\{[^}]*$/);
    if (m) {
      return { from: m.from + m.text.lastIndexOf('{') + 1, options: CLASSES.map((label) => ({ label, type: 'namespace' })), validFor: /^[\w-]*$/ };
    }
    m = ctx.matchBefore(/\\includegraphics(?:\[[^\]]*\])?\{[^}]*$/);
    if (m) {
      return { from: m.from + m.text.lastIndexOf('{') + 1, options: getters.images().map((label) => ({ label, type: 'text' })), validFor: /^[^}]*$/ };
    }
    m = ctx.matchBefore(/\\(?:input|include|subfile)\{[^}]*$/);
    if (m) {
      return { from: m.from + m.text.lastIndexOf('{') + 1, options: getters.texFiles().map((label) => ({ label, type: 'text' })), validFor: /^[^}]*$/ };
    }
    m = ctx.matchBefore(/\\(?:bibliography|addbibresource)\{[^}]*$/);
    if (m) {
      return { from: m.from + Math.max(m.text.lastIndexOf('{'), m.text.lastIndexOf(',')) + 1, options: getters.bibFiles().map((label) => ({ label, type: 'text' })), validFor: /^[^},]*$/ };
    }
    m = ctx.matchBefore(/\\[A-Za-z]*$/);
    if (m && (m.text.length > 1 || ctx.explicit)) {
      return { from: m.from, options: COMMANDS, validFor: /^\\[A-Za-z{}*]*$/ };
    }
    return null;
  };
}

// ------------------------------------------------------- the editor wrapper

export class Editor {
  constructor(parent, { onChange, onSave, onCompile, getters, onSelection }) {
    this.onChange = onChange;
    this.states = new Map(); // path -> EditorState (keeps undo history per file)
    this.current = null;
    this.diag = new Map(); // path -> [{from,to,severity,message}]
    this.suppress = false;
    this.onSelection = onSelection;

    this.extensions = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      indentUnit.of('  '),
      bracketMatching(),
      closeBrackets({ brackets: ['(', '[', '{', '$'] }),
      rectangularSelection(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      lintGutter(),
      autocompletion({ override: [latexCompletions(getters)], activateOnTyping: true, icons: false }),
      EditorView.lineWrapping,
      syntaxHighlighting(highlight),
      StreamLanguage.define(stex),
      theme,
      EditorView.inputHandler.of((view, from, to, text) => this.#autoEnd(view, from, to, text)),
      keymap.of([
        { key: 'Mod-s', preventDefault: true, run: () => { onSave?.(); return true; } },
        { key: 'Mod-Enter', preventDefault: true, run: () => { onCompile?.(); return true; } },
        { key: 'Mod-b', preventDefault: true, run: (v) => this.wrap('\\textbf{', '}') },
        { key: 'Mod-i', preventDefault: true, run: (v) => this.wrap('\\textit{', '}') },
        { key: 'Mod-/', preventDefault: true, run: () => this.toggleComment() },
        indentWithTab,
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...completionKeymap,
      ]),
      EditorView.updateListener.of((u) => {
        if (u.docChanged && !this.suppress) this.onChange?.(u.state.doc.toString());
        if (u.selectionSet || u.docChanged) this.onSelection?.(u.state);
      }),
    ];
    this.view = new EditorView({ state: EditorState.create({ doc: '', extensions: this.extensions }), parent });
  }

  #autoEnd(view, from, to, text) {
    if (text !== '}' || from !== to) return false;
    const line = view.state.doc.lineAt(from);
    const before = line.text.slice(0, from - line.from);
    const m = /\\begin\{([A-Za-z*]+)$/.exec(before);
    if (!m) return false;
    const after = line.text.slice(from - line.from);
    const rest = after.replace(/^\}/, '');
    if (rest.trim() !== '') return false;
    const name = m[1];
    // already closed further down?
    const tail = view.state.sliceDoc(line.to, Math.min(view.state.doc.length, line.to + 600));
    const nextEnd = tail.indexOf(`\\end{${name}}`);
    const nextBegin = tail.indexOf(`\\begin{${name}}`);
    if (nextEnd !== -1 && (nextBegin === -1 || nextEnd < nextBegin)) return false;
    const indent = /^\s*/.exec(line.text)[0];
    const end = from + (after.startsWith('}') ? 1 : 0);
    view.dispatch({
      changes: { from, to: end, insert: `}\n${indent}\t\n${indent}\\end{${name}}` },
      selection: { anchor: from + 1 + 1 + indent.length + 1 },
      userEvent: 'input.complete',
    });
    return true;
  }

  get doc() { return this.view.state.doc.toString(); }

  stash() {
    if (this.current != null) this.states.set(this.current, this.view.state);
  }

  setFile(path, text, line) {
    this.stash();
    let st = this.states.get(path);
    if (!st || st.doc.toString() !== text) {
      st = EditorState.create({ doc: text, extensions: this.extensions });
    }
    this.suppress = true;
    this.view.setState(st);
    this.suppress = false;
    this.current = path;
    this.#applyDiagnostics();
    if (line) this.goToLine(line);
  }

  forget(pathOrPrefix) {
    for (const k of [...this.states.keys()]) if (k === pathOrPrefix || k.startsWith(pathOrPrefix + '/')) this.states.delete(k);
  }

  rename(from, to) {
    for (const k of [...this.states.keys()]) {
      if (k === from || k.startsWith(from + '/')) { this.states.delete(k); }
    }
    if (this.current === from) this.current = to;
  }

  reset() {
    this.states.clear();
    this.current = null;
  }

  replaceDoc(text) {
    this.suppress = true;
    this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: text } });
    this.suppress = false;
  }

  setIssues(byFile) {
    this.diag = byFile;
    this.#applyDiagnostics();
  }

  #applyDiagnostics() {
    if (this.current == null) return;
    const list = this.diag.get(this.current) || [];
    const doc = this.view.state.doc;
    const diags = [];
    for (const d of list) {
      if (!d.line || d.line < 1 || d.line > doc.lines) continue;
      const ln = doc.line(d.line);
      const lead = ln.text.length - ln.text.trimStart().length;
      diags.push({
        from: ln.from + lead,
        to: Math.max(ln.from + lead + 1, ln.to),
        severity: d.severity,
        message: d.message,
      });
    }
    this.view.dispatch(setDiagnostics(this.view.state, diags));
  }

  goToLine(n) {
    const doc = this.view.state.doc;
    const ln = doc.line(Math.min(Math.max(1, n), doc.lines));
    this.view.dispatch({
      selection: EditorSelection.cursor(ln.from),
      effects: EditorView.scrollIntoView(ln.from, { y: 'center' }),
    });
    this.view.focus();
  }

  focus() { this.view.focus(); }

  wrap(before, after = '') {
    const { state } = this.view;
    this.view.dispatch(
      state.changeByRange((r) => {
        const sel = state.sliceDoc(r.from, r.to);
        return {
          changes: { from: r.from, to: r.to, insert: before + sel + after },
          range: sel
            ? EditorSelection.range(r.from + before.length, r.from + before.length + sel.length)
            : EditorSelection.cursor(r.from + before.length),
        };
      })
    );
    this.view.focus();
    return true;
  }

  insert(text, cursorBack = 0) {
    const { from, to } = this.view.state.selection.main;
    this.view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length - cursorBack },
    });
    this.view.focus();
  }

  insertBlock(text, cursorOffset) {
    const { state } = this.view;
    const r = state.selection.main;
    const line = state.doc.lineAt(r.from);
    const atStart = r.from === line.from;
    const prefix = atStart ? '' : '\n';
    this.view.dispatch({
      changes: { from: r.from, to: r.to, insert: prefix + text },
      selection: { anchor: r.from + prefix.length + (cursorOffset ?? text.length) },
    });
    this.view.focus();
  }

  toggleComment() {
    const { state } = this.view;
    const lines = new Set();
    for (const r of state.selection.ranges) {
      const a = state.doc.lineAt(r.from).number;
      const b = state.doc.lineAt(r.to).number;
      for (let n = a; n <= b; n++) lines.add(n);
    }
    const all = [...lines].map((n) => state.doc.line(n));
    const commented = all.every((l) => /^\s*%/.test(l.text) || l.text.trim() === '');
    const changes = [];
    for (const l of all) {
      if (l.text.trim() === '') continue;
      if (commented) {
        const m = /^(\s*)%\s?/.exec(l.text);
        if (m) changes.push({ from: l.from + m[1].length, to: l.from + m[0].length });
      } else {
        const lead = l.text.length - l.text.trimStart().length;
        changes.push({ from: l.from + lead, insert: '% ' });
      }
    }
    this.view.dispatch({ changes });
    return true;
  }

  selectionText() {
    const r = this.view.state.selection.main;
    return this.view.state.sliceDoc(r.from, r.to);
  }

  destroy() { this.view.destroy(); }
}
