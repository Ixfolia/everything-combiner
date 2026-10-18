import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { combinePdfs, parsePageRange } from '../src/combiners/pdf.js';

async function makePdf(pageCount, width) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([width + i, 500]);
  return doc.save();
}

test('parsePageRange handles lists, ranges and open ends', () => {
  assert.deepEqual(parsePageRange('', 3), [0, 1, 2]);
  assert.deepEqual(parsePageRange('1-3, 5, 8-', 9), [0, 1, 2, 4, 7, 8]);
  assert.deepEqual(parsePageRange('-2', 5), [0, 1]);
  assert.deepEqual(parsePageRange('3-1', 3), [2, 1, 0]);
});

test('parsePageRange rejects bad input', () => {
  assert.throws(() => parsePageRange('abc', 3), /Invalid page range/);
  assert.throws(() => parsePageRange('4', 3), /outside 1-3/);
  assert.throws(() => parsePageRange('0-2', 3), /outside 1-3/);
});

test('combines PDFs in order, honoring page ranges', async () => {
  const a = await makePdf(2, 100);
  const b = await makePdf(4, 200);
  const { bytes, pageCount } = await combinePdfs([
    { name: 'a.pdf', bytes: a },
    { name: 'b.pdf', bytes: b, pages: '2, 4' },
  ]);
  assert.equal(pageCount, 4);

  const out = await PDFDocument.load(bytes);
  const widths = out.getPages().map((p) => p.getWidth());
  assert.deepEqual(widths, [100, 101, 201, 203]);
});

test('reports which file is unreadable', async () => {
  await assert.rejects(
    combinePdfs([{ name: 'broken.pdf', bytes: new TextEncoder().encode('not a pdf') }]),
    /broken\.pdf/,
  );
});
