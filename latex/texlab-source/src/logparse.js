// Turns a TeX log into a list of issues with file + line, so the UI can show
// them as clickable cards and underline them in the editor.

const HINTS = [
  [/Undefined control sequence/, 'A command was used that LaTeX does not know. Check the spelling, or add the package that defines it with \\usepackage{…}.'],
  [/Missing \$ inserted/, 'Math-only content (such as _ ^ or \\alpha) was used outside math mode. Wrap it in $…$, or escape the character (\\_).'],
  [/File `([^']+)' not found/, 'The file could not be found. Check the name and that it is uploaded to the project, or that the package exists in TeX Live.'],
  [/Missing \\begin\{document\}/, 'Something printable appeared before \\begin{document}. This is often a stray character in the preamble.'],
  [/Runaway argument|Paragraph ended before/, 'A closing brace } is probably missing, or a blank line appeared inside a command argument.'],
  [/Extra alignment tab/, 'A table row has more & separators than the column specification declares.'],
  [/Missing number, treated as zero/, 'A length or number was expected here. Check the command in front of this line.'],
  [/Environment (\S+) undefined/, 'The environment is unknown. It may need a package, or the name may be misspelled.'],
  [/\\begin\{(.+?)\} on input line \d+ ended by \\end\{(.+?)\}/, 'A \\begin and \\end do not match. Look for a missing \\end or a typo in the environment name.'],
  [/Too many \}'s/, 'There is one } too many. Look for an unmatched brace just before this line.'],
  [/Emergency stop|Fatal error/, 'LaTeX cannot continue after the first error. Fix the error above this one first.'],
  [/Unicode character|Unicode char/, 'This character is not available in the current font/encoding. Use a different font setup or replace the character.'],
];

function unwrap(log) {
  // TeX wraps log lines at 79 characters; glue those back together
  const raw = log.replace(/\r/g, '').split('\n');
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    let line = raw[i];
    while (line.length === 79 && i + 1 < raw.length && !/^(!|l\.\d|\s*$)/.test(raw[i + 1])) {
      line += raw[++i];
    }
    out.push(line);
  }
  return out;
}

const FILE_RE = /\(((?:\.\/|\/)?[^\s()"{}]+\.(?:tex|sty|cls|clo|def|cfg|fd|bbl|aux|toc|lof|lot|out|bib|ldf|dtx|cbx|bbx|lbx))/g;

export function parseLog(log, { mainFile = 'main.tex', workDir = '' } = {}) {
  const lines = unwrap(log || '');
  const issues = [];
  const stack = [];

  const current = () => {
    for (let i = stack.length - 1; i >= 0; i--) {
      const f = stack[i];
      if (f && !/(^|\/)(?:texmf|tex\/latex|texlive)/.test(f) && !/\.(sty|cls|clo|def|cfg|fd|ldf|cbx|bbx|lbx)$/.test(f)) {
        return f.replace(/^\.\//, '');
      }
    }
    return mainFile.slice(workDir.length);
  };

  const track = (line) => {
    // push files that open on this line, pop for each ')' outside of them
    let idx = 0;
    const opens = [...line.matchAll(FILE_RE)];
    let o = 0;
    while (idx < line.length) {
      const c = line[idx];
      if (c === '(') {
        if (o < opens.length && opens[o].index === idx) {
          stack.push(opens[o][1]);
          idx += opens[o][0].length;
          o++;
          continue;
        }
        stack.push(null);
      } else if (c === ')') {
        stack.pop();
      }
      idx++;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('! ') || line.startsWith('!pdfTeX error')) {
      const file = current();
      let msg = line.startsWith('! ') ? line.slice(2).trim() : line.slice(1).trim();
      let lineNo = null;
      const ctx = [];
      let j = i + 1;
      for (; j < Math.min(lines.length, i + 14); j++) {
        const l = lines[j];
        const m = /^l\.(\d+)\s?(.*)$/.exec(l);
        if (m) {
          lineNo = parseInt(m[1], 10);
          ctx.push(m[2]);
          if (lines[j + 1] !== undefined && lines[j + 1].trim() !== '' && !lines[j + 1].startsWith('!')) ctx.push(lines[j + 1].trim());
          break;
        }
        if (l.startsWith('! ')) break;
        if (l.trim()) ctx.push(l);
      }
      // "! LaTeX Error: File `foo.sty' not found." etc. keep the whole sentence
      if (/^Undefined control sequence/.test(msg)) {
        const bad = ctx.find((c) => /\\[A-Za-z@]+$/.test(c.trim()));
        if (bad) msg += ' ' + bad.trim().match(/\\[A-Za-z@]+$/)[0];
      }
      let hint = '';
      for (const [re, text] of HINTS) if (re.test(msg + ' ' + ctx.join(' '))) { hint = text; break; }
      issues.push({ level: 'error', msg, file, line: lineNo, context: ctx.filter(Boolean).slice(-2).join('\n'), hint });
      i = Math.max(i, j - 1);
      track(line);
      continue;
    }

    let m;
    if ((m = /^(LaTeX|Package \S+|Class \S+) (Warning|Info):\s*(.*)$/.exec(line)) && m[2] === 'Warning') {
      let msg = m[3];
      let j = i + 1;
      while (j < lines.length && /^\(\S+\)\s+/.test(lines[j])) { msg += ' ' + lines[j].replace(/^\(\S+\)\s+/, ''); j++; }
      const ln = /on input line (\d+)/.exec(msg);
      issues.push({
        level: 'warning',
        msg: msg.replace(/\s*on input line \d+\.?$/, '').trim(),
        source: m[1],
        file: current(),
        line: ln ? parseInt(ln[1], 10) : null,
        context: '',
      });
      i = j - 1;
    } else if ((m = /^(Overfull|Underfull) \\[hv]box .*?(?:at lines? (\d+)(?:--\d+)?|in paragraph at lines (\d+)--\d+|detected at line (\d+))/.exec(line))) {
      issues.push({
        level: 'typesetting',
        msg: line.replace(/\s*\[\]\s*$/, '').trim(),
        file: current(),
        line: parseInt(m[2] || m[3] || m[4], 10),
        context: '',
      });
    } else if (/^No file .+\.(aux|toc|lof|lot|bbl|out)\.?$/.test(line)) {
      // routine on the first pass, not worth showing
    }
    track(line);
  }
  return issues;
}

export function needsRerun(log) {
  return /Rerun to get|Rerun LaTeX|Please rerun|Label\(s\) may have changed|There were undefined (?:references|citations)|Citation `[^']*' on page \d+ undefined|Reference `[^']*' on page \d+ undefined|No file [^\s]+\.(?:aux|toc|lof|lot|out)/.test(log || '');
}
