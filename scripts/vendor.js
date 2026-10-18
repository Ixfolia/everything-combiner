// Copies browser builds of runtime dependencies into vendor/ so the app works offline.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'vendor'), { recursive: true });
copyFileSync(
  join(root, 'node_modules/pdf-lib/dist/pdf-lib.esm.min.js'),
  join(root, 'vendor/pdf-lib.esm.min.js'),
);
console.log('Copied pdf-lib into vendor/');
