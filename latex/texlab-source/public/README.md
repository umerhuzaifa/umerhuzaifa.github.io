# TeXLab: LaTeX editor for GitHub Pages

Static site. Upload the contents of this folder to your GitHub Pages repo, e.g. into `latex/`,
then open https://umerhuzaifa.com/latex/

- All paths are relative, so any sub-folder works. Pages must be served over https (GitHub Pages is).
- Projects are stored in each visitor's browser (IndexedDB). Use "Back up all projects" regularly.
- `texlive/cache` (~80 MB) is an offline package bundle. Delete it to shrink the repo; missing packages
  are then fetched on demand from a TeX Live mirror (jsDelivr) and cached.
- Beamer and packages outside the bundle load from the mirror on first use (needs internet once).
- Licences: see LICENSES.txt. Engine: SwiftLaTeX pdfTeX (EPL-2.0/GPL-2.0 CPE), bundle from TeXbrain (MIT).
