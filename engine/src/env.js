// Minimal .env loader (no dependency). Real env vars always win.
// Order: engine/.env, then the repo root .env.local / .env (shared with the Next app).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ENGINE_DIR = path.resolve(here, '..');
const ROOT_DIR = path.resolve(ENGINE_DIR, '..');

function loadFile(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return; }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2];
    if (/^(['"]).*\1$/.test(val)) val = val.slice(1, -1);
    else val = val.replace(/\s+#.*$/, '');
    if (process.env[m[1]] === undefined || process.env[m[1]] === '') {
      if (val !== '') process.env[m[1]] = val;
    }
  }
}

for (const f of [path.join(ENGINE_DIR, '.env'), path.join(ROOT_DIR, '.env.local'), path.join(ROOT_DIR, '.env')]) {
  loadFile(f);
}
