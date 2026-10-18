import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combineText, unescapeSeparator } from '../src/combiners/text.js';
import { sortByName } from '../src/combiners/sort.js';

const files = [
  { name: 'a.txt', text: '  Hello\r\nworld  \n' },
  { name: 'b.txt', text: '﻿Second file' },
];

test('by default the output is just the file contents, one after another', () => {
  assert.equal(combineText(files), 'Hello\nworld\nSecond file\n');
});

test('can add file name headers and a blank line between files', () => {
  const out = combineText(files, { includeHeaders: true, separator: '\n\n' });
  assert.equal(out, '===== a.txt =====\nHello\nworld\n\n===== b.txt =====\nSecond file\n');
});

test('can omit headers and use a custom separator', () => {
  const out = combineText(files, { includeHeaders: false, separator: unescapeSeparator('\\n---\\n') });
  assert.equal(out, 'Hello\nworld\n---\nSecond file\n');
});

test('header template supports index and total', () => {
  const out = combineText(files, { includeHeaders: true, headerTemplate: '[{index}/{total}] {name}' });
  assert.match(out, /^\[1\/2\] a\.txt\n/);
  assert.match(out, /\[2\/2\] b\.txt\nSecond file\n$/);
});

test('skips empty files and keeps them when asked', () => {
  const withEmpty = [...files, { name: 'empty.txt', text: '  \n ' }];
  const headers = { includeHeaders: true };
  assert.doesNotMatch(combineText(withEmpty, headers), /empty\.txt/);
  assert.match(combineText(withEmpty, { ...headers, skipEmpty: false }), /===== empty\.txt =====\n$/);
});

test('no trim keeps whitespace', () => {
  const out = combineText([files[0]], { trim: false, includeHeaders: false });
  assert.equal(out, '  Hello\nworld  \n\n');
});

test('writes CRLF line endings', () => {
  assert.equal(combineText(files, { lineEndings: 'crlf' }), 'Hello\r\nworld\r\nSecond file\r\n');
});

test('empty input gives empty output', () => {
  assert.equal(combineText([]), '');
});

test('natural sort orders numbered transcripts correctly', () => {
  const sorted = sortByName([{ name: 'part10.txt' }, { name: 'Part2.txt' }, { name: 'part1.txt' }]);
  assert.deepEqual(sorted.map((f) => f.name), ['part1.txt', 'Part2.txt', 'part10.txt']);
});
