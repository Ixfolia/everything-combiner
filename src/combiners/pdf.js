// Combines PDF files into a single PDF, optionally selecting page ranges per file.
import { PDFDocument } from 'pdf-lib';

/**
 * Parses a page range like "1-3, 5, 8-" into zero-based page indices.
 * An empty/blank range selects every page.
 * @param {string} range
 * @param {number} pageCount
 * @returns {number[]}
 */
export function parsePageRange(range, pageCount) {
  const trimmed = (range ?? '').trim();
  if (trimmed === '') return Array.from({ length: pageCount }, (_, i) => i);

  const indices = [];
  for (const raw of trimmed.split(',')) {
    const part = raw.trim();
    if (part === '') continue;

    const match = /^(\d*)\s*-\s*(\d*)$/.exec(part) ?? /^(\d+)$/.exec(part);
    if (!match) throw new Error(`Invalid page range "${part}"`);

    const isRange = part.includes('-');
    const start = match[1] === '' ? 1 : Number(match[1]);
    const end = isRange ? (match[2] === '' ? pageCount : Number(match[2])) : start;

    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      throw new Error(`Page range "${part}" is outside 1-${pageCount}`);
    }
    const step = start <= end ? 1 : -1;
    for (let p = start; p !== end + step; p += step) indices.push(p - 1);
  }
  return indices;
}

/**
 * @param {{ name: string, bytes: Uint8Array | ArrayBuffer, pages?: string }[]} files
 * @returns {Promise<{ bytes: Uint8Array, pageCount: number }>}
 */
export async function combinePdfs(files) {
  const output = await PDFDocument.create();

  for (const file of files) {
    let source;
    try {
      source = await PDFDocument.load(file.bytes, { ignoreEncryption: true });
    } catch (err) {
      throw new Error(`Could not read "${file.name}": ${err.message}`);
    }

    let indices;
    try {
      indices = parsePageRange(file.pages, source.getPageCount());
    } catch (err) {
      throw new Error(`${file.name}: ${err.message}`);
    }

    const pages = await output.copyPages(source, indices);
    for (const page of pages) output.addPage(page);
  }

  return { bytes: await output.save(), pageCount: output.getPageCount() };
}

export async function getPdfPageCount(bytes) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPageCount();
}
