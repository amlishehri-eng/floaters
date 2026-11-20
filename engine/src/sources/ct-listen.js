// `npm run ct`: long-running Certificate Transparency listener.
// Connects to a certstream websocket, keeps landing pages of deep-tech-sounding domains on startup TLDs,
// appends them to data/ct_candidates.jsonl. The pipeline ingests new lines via a stored byte offset.
//
// Public stream (often down): wss://certstream.calidog.io/
// Self-host:  docker run -d -p 8080:8080 0rickyy0/certstream-server-go   ->  CERTSTREAM_URL=ws://localhost:8080/full-stream
import fs from 'node:fs';
import path from 'node:path';
import config from '../../config.js';
import { filterCtDomain, extractCtDomains } from '../ct-filter.js';

const url = process.env.CERTSTREAM_URL || config.ct.url;
const file = config.ctFile;
fs.mkdirSync(path.dirname(file), { recursive: true });

// Dedupe across restarts.
const seen = new Set();
try {
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    try { seen.add(JSON.parse(line).domain); } catch { /* skip */ }
  }
} catch { /* first run */ }

const stats = { messages: 0, domains: 0, kept: 0, since: Date.now() };
let backoff = 1000;

function handle(raw) {
  stats.messages++;
  let msg;
  try { msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString()); } catch { return; }
  const ext = extractCtDomains(msg);
  if (!ext) return;
  for (const d of ext.domains) {
    stats.domains++;
    const hit = filterCtDomain(d);
    if (!hit || seen.has(hit.domain)) continue;
    seen.add(hit.domain);
    stats.kept++;
    const rec = {
      domain: hit.domain, host: hit.host, keyword: hit.keyword,
      seen: new Date(ext.seen).toISOString(),
      notBefore: ext.notBefore ? new Date(ext.notBefore).toISOString() : null,
      issuer: ext.issuer,
    };
    fs.appendFileSync(file, JSON.stringify(rec) + '\n');
    console.log(`[ct] + ${hit.host}  (${hit.keyword})`);
  }
}

function connect() {
  console.log(`[ct] connecting to ${url}`);
  let ws;
  let retried = false;
  const again = () => { if (!retried) { retried = true; retry(); } };
  try {
    ws = new WebSocket(url);
  } catch (e) {
    console.error(`[ct] cannot open websocket: ${e.message}`);
    return again();
  }
  ws.addEventListener('open', () => {
    console.log('[ct] connected, listening for new certificates…');
    backoff = 1000;
  });
  ws.addEventListener('message', async (ev) => {
    const data = typeof ev.data === 'string' ? ev.data : ev.data instanceof Blob ? await ev.data.text() : Buffer.from(ev.data).toString();
    handle(data);
  });
  // A failed handshake may emit only 'error' (no 'close'), so both paths schedule one retry.
  ws.addEventListener('error', (ev) => { console.error(`[ct] websocket error: ${ev.message || 'connection failed'}`); again(); });
  ws.addEventListener('close', (ev) => { console.warn(`[ct] closed (${ev.code}).`); again(); });
}

function retry() {
  console.log(`[ct] reconnecting in ${Math.round(backoff / 1000)}s. If this keeps failing, self-host: docker run -d -p 8080:8080 0rickyy0/certstream-server-go and set CERTSTREAM_URL=ws://localhost:8080/full-stream`);
  setTimeout(connect, backoff);
  backoff = Math.min(backoff * 2, 60000);
}

setInterval(() => {
  const mins = ((Date.now() - stats.since) / 60000).toFixed(1);
  console.log(`[ct] ${mins} min: ${stats.messages} msgs, ${stats.domains} domains, ${stats.kept} kept -> ${path.relative(process.cwd(), file)}`);
}, 60000); // keeps the process alive between reconnects

connect();
