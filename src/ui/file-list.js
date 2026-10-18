// Reusable, reorderable file list with a drop zone.
import { sortByName } from '../combiners/sort.js';

let nextId = 1;

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export class FileList {
  /**
   * @param {HTMLElement} root element containing the [data-role] children
   * @param {{
   *   accept: (file: File) => boolean,
   *   load: (file: File) => Promise<object>,
   *   renderExtra?: (item: object, onChange: () => void) => HTMLElement | null,
   *   onChange?: () => void,
   *   onError?: (message: string) => void,
   * }} config
   */
  constructor(root, config) {
    this.root = root;
    this.config = config;
    this.items = [];
    this.dragId = null;

    this.listEl = root.querySelector('[data-role="list"]');
    this.dropEl = root.querySelector('[data-role="drop"]');
    this.inputEl = root.querySelector('[data-role="input"]');
    this.countEl = root.querySelector('[data-role="count"]');

    this.inputEl.addEventListener('change', () => {
      this.addFiles([...this.inputEl.files]);
      this.inputEl.value = '';
    });

    for (const type of ['dragenter', 'dragover']) {
      this.dropEl.addEventListener(type, (e) => {
        if (!e.dataTransfer?.types.includes('Files')) return;
        e.preventDefault();
        this.dropEl.classList.add('is-over');
      });
    }
    for (const type of ['dragleave', 'drop']) {
      this.dropEl.addEventListener(type, () => this.dropEl.classList.remove('is-over'));
    }
    this.dropEl.addEventListener('drop', (e) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      this.addFiles([...e.dataTransfer.files]);
    });

    root.querySelector('[data-action="sort-asc"]')?.addEventListener('click', () => this.sort('asc'));
    root.querySelector('[data-action="sort-desc"]')?.addEventListener('click', () => this.sort('desc'));
    root.querySelector('[data-action="clear"]')?.addEventListener('click', () => {
      this.items = [];
      this.changed();
    });

    this.render();
  }

  async addFiles(files) {
    const accepted = files.filter((f) => this.config.accept(f));
    const rejected = files.length - accepted.length;
    if (rejected > 0) {
      this.config.onError?.(`Skipped ${rejected} file${rejected === 1 ? '' : 's'} of the wrong type.`);
    }

    // Keep the selection order stable even though files load asynchronously.
    const results = await Promise.allSettled(accepted.map((f) => this.config.load(f)));
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        this.items.push({ id: nextId++, name: accepted[i].name, size: accepted[i].size, ...result.value });
      } else {
        this.config.onError?.(`Could not load "${accepted[i].name}": ${result.reason?.message ?? result.reason}`);
      }
    });
    this.changed();
  }

  sort(direction) {
    this.items = sortByName(this.items, direction);
    this.changed();
  }

  move(id, delta) {
    const from = this.items.findIndex((i) => i.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= this.items.length) return;
    const [item] = this.items.splice(from, 1);
    this.items.splice(to, 0, item);
    this.changed();
  }

  moveBefore(id, targetId) {
    if (id === targetId) return;
    const from = this.items.findIndex((i) => i.id === id);
    const [item] = this.items.splice(from, 1);
    const to = this.items.findIndex((i) => i.id === targetId);
    this.items.splice(to, 0, item);
    this.changed();
  }

  remove(id) {
    this.items = this.items.filter((i) => i.id !== id);
    this.changed();
  }

  changed() {
    this.render();
    this.config.onChange?.();
  }

  render() {
    this.listEl.replaceChildren();
    this.root.classList.toggle('has-files', this.items.length > 0);
    if (this.countEl) {
      this.countEl.textContent = `${this.items.length} file${this.items.length === 1 ? '' : 's'}`;
    }

    this.items.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'file-row';
      li.draggable = true;
      li.dataset.id = item.id;

      li.addEventListener('dragstart', (e) => {
        this.dragId = item.id;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(item.id));
        li.classList.add('is-dragging');
      });
      li.addEventListener('dragend', () => {
        this.dragId = null;
        li.classList.remove('is-dragging');
      });
      li.addEventListener('dragover', (e) => {
        if (this.dragId === null) return;
        e.preventDefault();
        li.classList.add('is-target');
      });
      li.addEventListener('dragleave', () => li.classList.remove('is-target'));
      li.addEventListener('drop', (e) => {
        if (this.dragId === null) return;
        e.preventDefault();
        e.stopPropagation();
        this.moveBefore(this.dragId, item.id);
      });

      const handle = document.createElement('span');
      handle.className = 'file-handle';
      handle.textContent = '⋮⋮';
      handle.setAttribute('aria-hidden', 'true');

      const position = document.createElement('span');
      position.className = 'file-index';
      position.textContent = String(index + 1);

      const info = document.createElement('div');
      info.className = 'file-info';
      const name = document.createElement('span');
      name.className = 'file-name';
      name.textContent = item.name;
      name.title = item.name;
      const meta = document.createElement('span');
      meta.className = 'file-meta';
      meta.textContent = [formatBytes(item.size), item.meta].filter(Boolean).join(' · ');
      info.append(name, meta);

      const extra = this.config.renderExtra?.(item, () => this.config.onChange?.());

      const actions = document.createElement('div');
      actions.className = 'file-actions';
      actions.append(
        iconButton('↑', `Move ${item.name} up`, index === 0, () => this.move(item.id, -1)),
        iconButton('↓', `Move ${item.name} down`, index === this.items.length - 1, () => this.move(item.id, 1)),
        iconButton('✕', `Remove ${item.name}`, false, () => this.remove(item.id)),
      );

      li.append(handle, position, info);
      if (extra) li.append(extra);
      li.append(actions);
      this.listEl.append(li);
    });
  }
}

function iconButton(label, title, disabled, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-button';
  button.textContent = label;
  button.title = title;
  button.setAttribute('aria-label', title);
  button.disabled = disabled;
  button.addEventListener('click', onClick);
  return button;
}
