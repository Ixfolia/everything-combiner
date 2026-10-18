// Combines plain-text files (e.g. transcripts) into a single text document.

export const defaultTextOptions = {
  // Write a header line with the source file name before each file's contents.
  // Off by default so the output is just the combined text.
  includeHeaders: false,
  // Header template. {name} = file name, {index} = 1-based position, {total} = file count.
  headerTemplate: '===== {name} =====',
  // Text placed between files. Escapes like \n are interpreted.
  separator: '\n',
  // Trim leading/trailing whitespace from each file.
  trim: true,
  // Line ending style for the output: 'lf' or 'crlf'.
  lineEndings: 'lf',
  // Skip files that are empty (after trimming, if enabled).
  skipEmpty: true,
};

export function unescapeSeparator(value) {
  return value.replace(/\\(n|r|t|\\)/g, (_, c) => ({ n: '\n', r: '\r', t: '\t', '\\': '\\' })[c]);
}

export function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function formatHeader(template, name, index, total) {
  return template
    .replaceAll('{name}', name)
    .replaceAll('{index}', String(index))
    .replaceAll('{total}', String(total));
}

/**
 * @param {{ name: string, text: string }[]} files in the order they should appear
 * @param {Partial<typeof defaultTextOptions>} options
 * @returns {string}
 */
export function combineText(files, options = {}) {
  const opts = { ...defaultTextOptions, ...options };

  const prepared = files
    .map((f) => {
      let text = stripBom(f.text).replace(/\r\n?/g, '\n');
      if (opts.trim) text = text.trim();
      return { name: f.name, text };
    })
    .filter((f) => !(opts.skipEmpty && f.text.trim() === ''));

  const separator = opts.separator.replace(/\r\n?/g, '\n');
  const total = prepared.length;
  const combined = prepared
    .map((f, i) => {
      if (!opts.includeHeaders) return f.text;
      const header = formatHeader(opts.headerTemplate, f.name, i + 1, total);
      return f.text ? `${header}\n${f.text}` : header;
    })
    .join(separator);

  const result = combined === '' ? '' : `${combined}\n`;
  return opts.lineEndings === 'crlf' ? result.replace(/\n/g, '\r\n') : result;
}
