import { FileList } from './file-list.js';
import { combineText, unescapeSeparator } from '../combiners/text.js';
import { combinePdfs, getPdfPageCount, parsePageRange } from '../combiners/pdf.js';

const statusEl = document.getElementById('status');
let statusTimer;

function showStatus(message, kind = 'info') {
  clearTimeout(statusTimer);
  statusEl.textContent = message;
  statusEl.dataset.kind = kind;
  statusEl.hidden = false;
  statusTimer = setTimeout(() => (statusEl.hidden = true), kind === 'error' ? 8000 : 4000);
}

function download(data, fileName, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ensureExtension(name, ext) {
  const trimmed = name.trim() || `combined${ext}`;
  return trimmed.toLowerCase().endsWith(ext) ? trimmed : `${trimmed}${ext}`;
}

function hasExtension(file, extensions) {
  const lower = file.name.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

// ---- Tabs ------------------------------------------------------------------

const tabs = [...document.querySelectorAll('[role="tab"]')];

function selectTab(tab) {
  statusEl.hidden = true;
  for (const t of tabs) {
    const selected = t === tab;
    t.setAttribute('aria-selected', String(selected));
    t.tabIndex = selected ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
  }
  try { localStorage.setItem('combiner-tab', tab.id); } catch { /* storage unavailable */ }
}

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', (e) => {
    const delta = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!delta) return;
    const next = tabs[(i + delta + tabs.length) % tabs.length];
    selectTab(next);
    next.focus();
  });
});

try {
  const saved = document.getElementById(localStorage.getItem('combiner-tab'));
  if (saved && tabs.includes(saved)) selectTab(saved);
} catch { /* storage unavailable */ }

// ---- Text combiner ---------------------------------------------------------

const TEXT_EXTENSIONS = ['.txt', '.text', '.md', '.srt', '.vtt', '.log', '.csv'];
const textForm = document.getElementById('text-options');
const textPreview = document.getElementById('text-preview');
const customSeparatorField = textForm.querySelector('[data-show-when="custom"]');

const textFiles = new FileList(document.getElementById('text-files'), {
  accept: (f) => hasExtension(f, TEXT_EXTENSIONS) || f.type.startsWith('text/'),
  load: async (f) => {
    const text = await f.text();
    const lines = text === '' ? 0 : text.split(/\r\n|\r|\n/).length;
    return { text, meta: `${lines.toLocaleString()} line${lines === 1 ? '' : 's'}` };
  },
  onChange: updateTextPreview,
  onError: (msg) => showStatus(msg, 'error'),
});

function readTextOptions() {
  const data = new FormData(textForm);
  const separatorChoice = data.get('separator');
  const rawSeparator = separatorChoice === 'custom' ? data.get('customSeparator') : separatorChoice;
  return {
    includeHeaders: data.has('includeHeaders'),
    headerTemplate: data.get('headerTemplate'),
    separator: unescapeSeparator(rawSeparator),
    trim: data.has('trim'),
    skipEmpty: data.has('skipEmpty'),
    lineEndings: data.get('lineEndings'),
  };
}

function buildText() {
  return combineText(textFiles.items, readTextOptions());
}

const PREVIEW_LIMIT = 20000;

function updateTextPreview() {
  customSeparatorField.hidden = textForm.elements.separator.value !== 'custom';
  textForm.elements.headerTemplate.disabled = !textForm.elements.includeHeaders.checked;

  const body = textPreview.querySelector('[data-role="preview-body"]');
  const stats = textPreview.querySelector('[data-role="preview-stats"]');
  if (textFiles.items.length === 0) {
    body.textContent = 'Add some files to see the combined result.';
    stats.textContent = '';
    return;
  }
  const text = buildText();
  const lines = text === '' ? 0 : text.split('\n').length - 1;
  stats.textContent = `(${text.length.toLocaleString()} characters, ${lines.toLocaleString()} lines)`;
  body.textContent = text.length > PREVIEW_LIMIT
    ? `${text.slice(0, PREVIEW_LIMIT)}\n\n… preview truncated, the download contains everything …`
    : text;
}

textForm.addEventListener('input', updateTextPreview);
textForm.addEventListener('change', updateTextPreview);

textForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (textFiles.items.length === 0) return showStatus('Add at least one text file first.', 'error');
  const fileName = ensureExtension(textForm.elements.fileName.value, '.txt');
  download(buildText(), fileName, 'text/plain;charset=utf-8');
  showStatus(`Combined ${textFiles.items.length} files into ${fileName}.`, 'success');
});

textForm.querySelector('[data-action="copy"]').addEventListener('click', async () => {
  if (textFiles.items.length === 0) return showStatus('Add at least one text file first.', 'error');
  try {
    await navigator.clipboard.writeText(buildText());
    showStatus('Combined text copied to the clipboard.', 'success');
  } catch {
    showStatus('Clipboard access was blocked by the browser.', 'error');
  }
});

updateTextPreview();

// ---- PDF combiner ----------------------------------------------------------

const pdfForm = document.getElementById('pdf-options');
const pdfSubmit = pdfForm.querySelector('button[type="submit"]');

const pdfFiles = new FileList(document.getElementById('pdf-files'), {
  accept: (f) => hasExtension(f, ['.pdf']) || f.type === 'application/pdf',
  load: async (f) => {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const pageCount = await getPdfPageCount(bytes);
    return { bytes, pageCount, pages: '', meta: `${pageCount} page${pageCount === 1 ? '' : 's'}` };
  },
  renderExtra: (item) => {
    const label = document.createElement('label');
    label.className = 'page-range';
    label.textContent = 'Pages';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `all (1-${item.pageCount})`;
    input.value = item.pages;
    input.addEventListener('input', () => {
      item.pages = input.value;
      try {
        parsePageRange(item.pages, item.pageCount);
        input.setCustomValidity('');
      } catch (err) {
        input.setCustomValidity(err.message);
      }
      input.title = input.validationMessage;
    });
    label.append(input);
    return label;
  },
  onError: (msg) => showStatus(msg, 'error'),
});

pdfForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (pdfFiles.items.length === 0) return showStatus('Add at least one PDF first.', 'error');

  pdfSubmit.disabled = true;
  pdfSubmit.textContent = 'Combining…';
  try {
    const { bytes, pageCount } = await combinePdfs(pdfFiles.items);
    const fileName = ensureExtension(pdfForm.elements.fileName.value, '.pdf');
    download(bytes, fileName, 'application/pdf');
    showStatus(`Combined ${pdfFiles.items.length} PDFs (${pageCount} pages) into ${fileName}.`, 'success');
  } catch (err) {
    showStatus(err.message, 'error');
  } finally {
    pdfSubmit.disabled = false;
    pdfSubmit.textContent = 'Combine & download';
  }
});
