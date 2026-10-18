# Everything Combiner

Combine many files into one. It currently has two combiners:

- **Text files**: merge transcripts or any other `.txt` files into a single text file.
- **PDF files**: merge PDFs into one PDF, with an optional page range for each file.

Everything runs locally. In the web app, files are never uploaded anywhere.

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
3. Choose options:
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

# Specific files, in the given order, without headers
node cli.js text --no-headers --separator "\n---\n" -o out.txt intro.txt part1.txt part2.txt

# Merge PDFs, taking pages 1-3 and 5 from the second one
node cli.js pdf -o merged.pdf cover.pdf report.pdf:1-3,5 appendix.pdf
```

Run `node cli.js --help` for every option.

## Project layout

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
