// Starter projects. Every template only uses packages that ship with the
// bundled TeX Live subset, so the first compile works offline.

const article = `\\documentclass[11pt]{article}

\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage[margin=1in]{geometry}
\\usepackage{amsmath, amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}

\\title{A Title for Your Article}
\\author{Your Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\begin{abstract}
A short summary of what this document is about.
\\end{abstract}

\\section{Introduction}
Welcome! Edit the source on the left and press \\textbf{Recompile} (or \\texttt{Ctrl+Enter}) to update the PDF on the right.

Inline math looks like $e^{i\\pi} + 1 = 0$, and display math looks like this:
\\begin{equation}
  \\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
  \\label{eq:gauss}
\\end{equation}
Equation~\\ref{eq:gauss} is the Gaussian integral.

\\section{Lists and tables}
\\begin{itemize}
  \\item First item
  \\item Second item
\\end{itemize}

\\begin{table}[h]
  \\centering
  \\begin{tabular}{lcr}
    \\hline
    Left & Center & Right \\\\
    \\hline
    1 & 2 & 3 \\\\
    4 & 5 & 6 \\\\
    \\hline
  \\end{tabular}
  \\caption{A small table.}
\\end{table}

\\section{Conclusion}
That is all you need to get started.

\\end{document}
`;

const refsBib = `@article{einstein1905,
  author  = {Albert Einstein},
  title   = {Zur Elektrodynamik bewegter K{\\"o}rper},
  journal = {Annalen der Physik},
  volume  = {322},
  number  = {10},
  pages   = {891--921},
  year    = {1905}
}

@book{knuth1984,
  author    = {Donald E. Knuth},
  title     = {The {\\TeX}book},
  publisher = {Addison-Wesley},
  address   = {Reading, Massachusetts},
  year      = {1984}
}

@inproceedings{lamport1978,
  author    = {Leslie Lamport},
  title     = {Time, Clocks, and the Ordering of Events in a Distributed System},
  booktitle = {Communications of the ACM},
  pages     = {558--565},
  year      = {1978}
}
`;

const articleBib = `\\documentclass[11pt]{article}

\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage[margin=1in]{geometry}
\\usepackage{amsmath}
\\usepackage{hyperref}

\\title{Writing with Citations}
\\author{Your Name}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Introduction}
Relativity was introduced by Einstein~\\cite{einstein1905}. For typesetting,
see Knuth's book~\\cite{knuth1984}. A classic distributed-systems paper is
\\cite{lamport1978}.

Add more entries to \\texttt{refs.bib}, cite them with \\verb|\\cite{key}|, and
the bibliography below updates automatically on every compile.

\\bibliographystyle{plain}
\\bibliography{refs}

\\end{document}
`;

const report = `\\documentclass[11pt]{report}

\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage[margin=1in]{geometry}
\\usepackage{amsmath}
\\usepackage{graphicx}
\\usepackage{hyperref}

\\title{Report Title}
\\author{Your Name}
\\date{\\today}

\\begin{document}
\\maketitle
\\tableofcontents

\\chapter{Introduction}
This is the first chapter. The table of contents is filled in on the second
pass, which TeXLab runs for you automatically.

\\section{Background}
Some background text.

\\chapter{Methods}
\\section{Approach}
Describe your approach here.

\\chapter{Results}
\\section{Findings}
Describe your findings here.

\\end{document}
`;

const beamer = `\\documentclass{beamer}

\\usetheme{Madrid}
\\usecolortheme{default}

\\title{Presentation Title}
\\subtitle{An optional subtitle}
\\author{Your Name}
\\institute{Your Institute}
\\date{\\today}

\\begin{document}

\\frame{\\titlepage}

\\begin{frame}{Outline}
  \\tableofcontents
\\end{frame}

\\section{Introduction}
\\begin{frame}{Motivation}
  \\begin{itemize}
    \\item<1-> Slides are built from \\texttt{frame} environments
    \\item<2-> Overlays reveal content step by step
    \\item<3-> Math works too: $a^2 + b^2 = c^2$
  \\end{itemize}
\\end{frame}

\\section{Results}
\\begin{frame}{A block}
  \\begin{block}{Theorem}
    Every bounded monotone sequence converges.
  \\end{block}
\\end{frame}

\\end{document}
`;

const letter = `\\documentclass[11pt]{letter}

\\usepackage[utf8]{inputenc}
\\usepackage[margin=1.1in]{geometry}

\\signature{Your Name}
\\address{Your Street 1 \\\\ 12345 Your City}

\\begin{document}

\\begin{letter}{Recipient Name \\\\ Recipient Street 5 \\\\ 54321 Their City}

\\opening{Dear Sir or Madam,}

I am writing to you about \\ldots

Replace this paragraph with the body of your letter.

\\closing{Yours sincerely,}

\\end{letter}
\\end{document}
`;

const cv = `\\documentclass[10pt]{article}

\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage[margin=0.8in]{geometry}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{titlesec}

\\pagestyle{empty}
\\titleformat{\\section}{\\large\\bfseries\\scshape}{}{0em}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{10pt}{6pt}
\\setlist[itemize]{leftmargin=1.2em, itemsep=1pt, topsep=2pt}

\\newcommand{\\role}[4]{%
  \\textbf{#1} \\hfill #3\\\\
  \\textit{#2} \\hfill \\textit{#4}\\\\[2pt]}

\\begin{document}

\\begin{center}
  {\\LARGE\\bfseries Your Name}\\\\[4pt]
  City, Country \\enspace|\\enspace you@example.com \\enspace|\\enspace \\href{https://example.com}{example.com}
\\end{center}

\\section{Experience}
\\role{Job Title}{Company}{2022 -- Present}{City}
\\begin{itemize}
  \\item Achievement with a measurable result.
  \\item Another responsibility or project.
\\end{itemize}

\\section{Education}
\\role{Degree, Subject}{University}{2018 -- 2022}{City}

\\section{Skills}
\\textbf{Languages:} English, \\ldots \\\\
\\textbf{Tools:} \\LaTeX, \\ldots

\\end{document}
`;

const thesisMain = `\\documentclass[12pt,a4paper]{report}

\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage[margin=1.25in]{geometry}
\\usepackage{amsmath, amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}

\\title{Thesis Title}
\\author{Your Name}
\\date{\\today}

\\begin{document}

\\maketitle
\\tableofcontents

\\input{chapters/introduction}
\\input{chapters/methods}
\\input{chapters/conclusion}

\\bibliographystyle{plain}
\\bibliography{refs}

\\end{document}
`;

const chapter = (title, text) => `\\chapter{${title}}
${text}
`;

export const TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank project',
    blurb: 'An empty document',
    main: 'main.tex',
    files: [
      {
        path: 'main.tex',
        content: `\\documentclass{article}\n\n\\begin{document}\n\nHello, world!\n\n\\end{document}\n`,
      },
    ],
  },
  { id: 'article', name: 'Article', blurb: 'Title, abstract, math, table', main: 'main.tex', files: [{ path: 'main.tex', content: article }] },
  {
    id: 'article-bib',
    name: 'Article with bibliography',
    blurb: 'BibTeX citations',
    main: 'main.tex',
    files: [
      { path: 'main.tex', content: articleBib },
      { path: 'refs.bib', content: refsBib },
    ],
  },
  { id: 'report', name: 'Report', blurb: 'Chapters and contents', main: 'main.tex', files: [{ path: 'main.tex', content: report }] },
  { id: 'beamer', name: 'Presentation', blurb: 'Beamer slides', main: 'main.tex', files: [{ path: 'main.tex', content: beamer }] },
  { id: 'letter', name: 'Letter', blurb: 'Formal letter', main: 'main.tex', files: [{ path: 'main.tex', content: letter }] },
  { id: 'cv', name: 'CV / Résumé', blurb: 'One-page layout', main: 'main.tex', files: [{ path: 'main.tex', content: cv }] },
  {
    id: 'thesis',
    name: 'Thesis (multi-file)',
    blurb: 'Chapters in folders',
    main: 'main.tex',
    files: [
      { path: 'main.tex', content: thesisMain },
      { path: 'chapters', dir: true },
      { path: 'chapters/introduction.tex', content: chapter('Introduction', 'State the problem and cite prior work~\\cite{knuth1984}.') },
      { path: 'chapters/methods.tex', content: chapter('Methods', 'Describe what you did.') },
      { path: 'chapters/conclusion.tex', content: chapter('Conclusion', 'Summarise and look ahead.') },
      { path: 'refs.bib', content: refsBib },
    ],
  },
];
