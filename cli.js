#!/usr/bin/env node
// Command-line front end for the combiners.
//
//   node cli.js text -o all.txt part1.txt part2.txt ...
//   node cli.js pdf  -o all.pdf a.pdf b.pdf:1-3 c.pdf
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { combineText, unescapeSeparator } from './src/combiners/text.js';
import { combinePdfs } from './src/combiners/pdf.js';
import { sortByName } from './src/combiners/sort.js';

const usage = `Usage:
  node cli.js text [options] <files or folders...>
  node cli.js pdf  [options] <files or folders...>

Common options:
  -o, --output <file>    Output file (default: combined.txt / combined.pdf)
  -s, --sort             Sort inputs by name (natural order) instead of argument order

Text options:
  --no-headers           Do not write a "===== name =====" header per file
  --header <template>    Header template; supports {name}, {index}, {total}
  --separator <text>     Text between files (default "\\n\\n"); \\n and \\t are understood
  --no-trim              Keep leading/trailing whitespace of each file
  --keep-empty           Keep files that are empty
  --crlf                 Write Windows (CRLF) line endings

PDF options:
  Append ":<range>" to a file to pick pages, e.g. report.pdf:1-3,5,8-

Folders are expanded to the matching files they contain, sorted by name.`;

const TEXT_EXTENSIONS = ['.txt', '.text', '.md', '.srt', '.vtt', '.log', '.csv'];

async function expandInputs(args, extensions) {
  const inputs = [];
  for (const arg of args) {
    // PDF page ranges: "file.pdf:1-3". Avoid treating Windows drive letters ("C:\...") as ranges.
    const rangeMatch = /^(.*\.pdf):([\d,\s-]*)$/i.exec(arg);
    const path = rangeMatch ? rangeMatch[1] : arg;
    const pages = rangeMatch ? rangeMatch[2] : '';

    const info = await stat(path).catch(() => null);
    if (!info) throw new Error(`File not found: ${path}`);

    if (info.isDirectory()) {
      const entries = (await readdir(path))
        .filter((name) => extensions.includes(extname(name).toLowerCase()))
        .map((name) => ({ name, path: join(path, name), pages: '' }));
      inputs.push(...sortByName(entries));
    } else {
      inputs.push({ name: basename(path), path, pages });
    }
  }
  return inputs;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!['text', 'pdf'].includes(command)) {
    console.log(usage);
    process.exitCode = command && !['-h', '--help'].includes(command) ? 1 : 0;
    return;
  }

  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      output: { type: 'string', short: 'o' },
      sort: { type: 'boolean', short: 's', default: false },
      'no-headers': { type: 'boolean', default: false },
      header: { type: 'string' },
      separator: { type: 'string' },
      'no-trim': { type: 'boolean', default: false },
      'keep-empty': { type: 'boolean', default: false },
      crlf: { type: 'boolean', default: false },
    },
  });

  if (positionals.length === 0) throw new Error('No input files given.\n\n' + usage);

  let inputs = await expandInputs(positionals, command === 'text' ? TEXT_EXTENSIONS : ['.pdf']);
  if (values.sort) inputs = sortByName(inputs);
  if (inputs.length === 0) throw new Error('No matching input files found.');

  if (command === 'text') {
    const output = values.output ?? 'combined.txt';
    const files = await Promise.all(
      inputs.map(async (f) => ({ name: f.name, text: await readFile(f.path, 'utf8') })),
    );
    const text = combineText(files, {
      includeHeaders: !values['no-headers'],
      ...(values.header !== undefined && { headerTemplate: values.header }),
      ...(values.separator !== undefined && { separator: unescapeSeparator(values.separator) }),
      trim: !values['no-trim'],
      skipEmpty: !values['keep-empty'],
      lineEndings: values.crlf ? 'crlf' : 'lf',
    });
    await writeFile(output, text, 'utf8');
    console.log(`Combined ${files.length} text files into ${output}`);
  } else {
    const output = values.output ?? 'combined.pdf';
    const files = await Promise.all(
      inputs.map(async (f) => ({ name: f.name, pages: f.pages, bytes: await readFile(f.path) })),
    );
    const { bytes, pageCount } = await combinePdfs(files);
    await writeFile(output, bytes);
    console.log(`Combined ${files.length} PDFs (${pageCount} pages) into ${output}`);
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exitCode = 1;
});
