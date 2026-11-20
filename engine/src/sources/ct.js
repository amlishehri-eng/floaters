// Pipeline side of CT: read lines appended by ct-listen.js since the last run (byte offset in store meta).
import fs from 'node:fs';
import config from '../../config.js';
import store from '../store.js';
import { makeSignal } from '../signals.js';

export async function collectCt({ max = 2000 } = {}) {
  const notes = [];
  let size = 0;
  try { size = fs.statSync(config.ctFile).size; } catch {
    return { signals: [], log: ['no ct_candidates.jsonl yet: start `npm run ct` in another terminal'], errors: [] };
  }
  let offset = await store.getMeta('ctOffset', 0);
  if (offset > size) offset = 0; // file was truncated / replaced
  if (offset === size) return { signals: [], log: ['no new CT candidates since last run'], errors: [] };

  const fd = fs.openSync(config.ctFile, 'r');
  const buf = Buffer.alloc(size - offset);
  fs.readSync(fd, buf, 0, buf.length, offset);
  fs.closeSync(fd);
  const text = buf.toString('utf8');
  const lastNl = text.lastIndexOf('\n');
  if (lastNl < 0) return { signals: [], log: ['partial CT line, waiting'], errors: [] };
  const complete = text.slice(0, lastNl);

  const signals = [];
  for (const line of complete.split('\n')) {
    if (!line.trim()) continue;
    let r;
    try { r = JSON.parse(line); } catch { continue; }
    signals.push(makeSignal({
      source: 'ct', type: 'certificate', domain: r.domain, url: `https://${r.host || r.domain}`, date: r.seen,
      data: { keyword: r.keyword, host: r.host, issuer: r.issuer, notBefore: r.notBefore },
    }));
  }
  // Oldest first if we have to cap; the rest stays for the next run.
  let consumed = Buffer.byteLength(complete, 'utf8') + 1;
  let taken = signals;
  if (signals.length > max) {
    taken = signals.slice(0, max);
    const keptLines = complete.split('\n').slice(0, max).join('\n');
    consumed = Buffer.byteLength(keptLines, 'utf8') + 1;
    notes.push(`capped at ${max}, ${signals.length - max} left for next run`);
  }
  await store.setMeta('ctOffset', offset + consumed);
  notes.unshift(`${taken.length} new CT candidates`);
  return { signals: taken, log: notes, errors: [] };
}
