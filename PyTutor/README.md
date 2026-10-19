# CSC 241 Python Visualizer

A Python Tutor–style step-through visualizer for CSC 241 (Introduction to Computing I, Python).
Students paste or pick a program, press **Visualize execution**, and watch frames, objects and
reference arrows update line by line. It runs entirely in the browser (Python compiled to
WebAssembly via [Pyodide](https://pyodide.org)), so there is no server to maintain and student
code never leaves their machine.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page layout and the two settings (`pyodideBase`, `maxSteps`) |
| `style.css` | Look and feel, animations (course purple/pink palette) |
| `app.js` | UI: editor, stepping, animated frames/objects, arrows |
| `tracer.py` | Records a snapshot of memory at every executed line (`sys.settrace`) |
| `examples.js` | 32 example programs grouped by the Fall 2026 weekly schedule |

## Hosting on your website

1. Upload the whole folder (all five files) to any static host (your department site, GitHub Pages, etc.). No build step.
2. Open `index.html` over `https://`. That's it.

To test on your own computer, run `python3 -m http.server` inside the folder and visit
`http://localhost:8000` (opening `index.html` by double-click will not work because the browser
blocks reading `tracer.py` from disk).

The Python engine is fetched from the jsDelivr CDN the first time a page loads (about 10 MB, then
cached by the browser). To self-host it instead, copy the contents of the `pyodide` npm package
(`npm pack pyodide`, then unpack it) into a folder
on your site and set `pyodideBase` in `index.html` to that folder (keep the trailing `/`).

## Linking and embedding (D2L, slides, etc.)

* `index.html?example=call-stack` opens a particular example and runs it.
* **Copy link** in the header produces `index.html#code=...`, a link that contains the student's own program.
* `index.html?embed=1&example=for-range` hides the header/footer so you can drop it in an `<iframe>`.

Example ids are the `id:` values in `examples.js`.

## Adding or editing examples

Open `examples.js` and add an object to a group:

```js
{
  id: "my-example",
  title: "Shown in the dropdown",
  watch: "One or two sentences telling students what to look for.",
  code: String.raw`x = 5
print(x)
`,
}
```

Keep code inside `String.raw` so `\n` stays literal; don't use backticks or a dollar-brace inside it.
Add `expectError: true` if the program is meant to crash.

## What it shows

* Global frame and one frame per active function call (parameters, locals, return value).
* Lists, tuples, sets, dicts, functions, and class instances as objects, with arrows for references
  (so aliasing like `b = a` is visible).
* Green arrow = next line to run, red arrow = line just run; click a line number to jump to the next time it runs.
* Animations: new frames slide in, new objects pop in, changed values flash, new arrows draw themselves, new program output is highlighted.
* A "Just changed" caption in plain words after every step.
* Step/back/play/pause/speed, slider, and keyboard shortcuts (← → Home End Space).

## Limits

* Programs stop after 2000 steps (infinite-loop protection); change `maxSteps` in `index.html`.
* `input()` uses a browser pop-up.
* Files written by a program live in a temporary in-browser disk.
* Only the standard library that ships with Pyodide is available (`math`, `random`, etc.).
* Containers show their first 60 items.

## Credits and legal

© 2026 Umer Huzaifa. Python Visualizer is an independent teaching tool written from scratch for CSC 241
at DePaul University. It is not affiliated with, endorsed by, or derived from the source code of
[Python Tutor](https://pythontutor.com) (created by Philip Guo), which popularized visualizing program
execution as frames, objects and pointer arrows. Python runs in the browser using
[Pyodide](https://pyodide.org) (Mozilla Public License 2.0). "Python" is a trademark of the Python
Software Foundation. Provided for educational use, as is, without warranty. The same notice appears in
the page footer in `index.html`; keep the two in sync if you edit one.
