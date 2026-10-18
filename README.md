# Everything Combiner

Combine many files into one. It currently has two combiners:

- **Text files**: merge transcripts or any other `.txt` files into a single text file.
- **PDF files**: merge PDFs into one PDF, with an optional page range for each file.

The combined `.txt` contains only the text of the input files, one after another (a line
break is added between two files only when one is missing). The combined `.pdf` contains
every page of each input PDF, in order. Everything runs locally; nothing is uploaded.

## Windows app (EverythingCombiner.exe)

A single, self-contained `EverythingCombiner.exe`. No installer and no .NET install needed.
Double-click it to run.

1. Pick the **Text files** or **PDF files** tab.
2. Drag files or a whole folder onto the list, or use **Add files…** / **Add folder…**.
   Files are added in natural name order (`part2.txt` before `part10.txt`).
3. Reorder by dragging rows, with **Move up** / **Move down** (or Alt+↑ / Alt+↓), or with **Sort A→Z**.
   Delete removes the selected rows.
4. Click **Combine into one .txt…** (or **.pdf…**), choose where to save, and you're done.

### Getting the exe

- **From GitHub Actions:** every push that touches `desktop/` runs the *Build Windows exe*
  workflow. Download `EverythingCombiner.exe` from the run's *Artifacts* section. Pushing a
  tag such as `v0.2.0` also attaches the exe to a GitHub release.
- **Build it yourself** (requires the .NET 8 SDK):

  ```bash
  dotnet publish desktop/EverythingCombiner.App -c Release -o dist
  # -> dist/EverythingCombiner.exe
  dotnet test desktop/EverythingCombiner.Tests
  ```

The C# source is in `desktop/`:

```
EverythingCombiner.Core/   TextCombiner, PdfCombiner (PDFsharp), NaturalStringComparer
EverythingCombiner.App/    WinForms UI (MainForm, CombinerPanel)
EverythingCombiner.Tests/  xUnit tests for the core library
```

## Web app

```bash
npm install   # installs pdf-lib and copies it into vendor/
npm start     # serves the app at http://localhost:8080
```

`vendor/` is committed, so any static file host (GitHub Pages, etc.) can serve the
repository as-is. Browsers don't load ES modules from `file://`, so open the app
through a server rather than double-clicking `index.html`.

### Text combiner

1. Drop `.txt` files (also `.md`, `.srt`, `.vtt`, `.log`, `.csv`) onto the page or click to pick them.
2. Put them in order by dragging rows, using the ↑ / ↓ buttons, or using **Sort A→Z**.
   Sorting is natural, so `part2.txt` comes before `part10.txt`.
3. By default the output is just the combined text. Optional extras:
   - a header line per file (template supports `{name}`, `{index}`, `{total}`)
   - what goes between files (blank line, dashed line, or a custom separator)
   - trimming whitespace, skipping empty files, and LF or CRLF line endings
4. Check the live preview, then **Combine & download** or **Copy to clipboard**.

### PDF combiner

1. Drop PDF files onto the page and put them in order.
2. Optionally enter a page range for a file, such as `1-3, 5, 8-`. Leave it blank to include every page.
   A reversed range like `5-1` adds those pages in reverse order.
3. **Combine & download**.

## Command line

```bash
# Combine every .txt in a folder (natural sort order) into one file
node cli.js text -o transcripts.txt ./transcripts

# Specific files, in the given order, with a file name header before each
node cli.js text --headers --separator "\n\n" -o out.txt intro.txt part1.txt part2.txt

# Merge PDFs, taking pages 1-3 and 5 from the second one
node cli.js pdf -o merged.pdf cover.pdf report.pdf:1-3,5 appendix.pdf
```

Run `node cli.js --help` for every option.

## Web app project layout

```
index.html, styles.css   web app shell
src/combiners/           combining logic shared by the web app and the CLI
  text.js                text combiner
  pdf.js                 PDF combiner and page range parser (uses pdf-lib)
  sort.js                natural file name sorting
src/ui/                  browser UI (tabs, reorderable file list)
cli.js                   command line front end
test/                    node:test unit tests (npm test)
```

To add another combiner, put its logic in `src/combiners/`, add a tab and panel to
`index.html`, and wire it up in `src/ui/app.js` with a `FileList`.
