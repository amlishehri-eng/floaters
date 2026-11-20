// HTTP API + static dashboard. node:http only. CORS open so the team's JS site can call it.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import config from '../config.js';
import store from './store.js';
import { startRun, isRunning, ingestSignals, processLeads } from './pipeline.js';
import { signalsFromText } from './sources/text.js';
import { makeSignal, familyOf, SOURCE_LABEL } from './signals.js';
import { normDomain, cleanName } from './normalize.js';
import { llmLabel, llmProvider } from './llm.js';
import { createBriefing, latestBriefing } from './briefing.js';

const STATUSES = ['new', 'watch', 'contact', 'rejected'];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
    'access-control-allow-headers': 'content-type',
    ...(isJson ? { 'content-type': 'application/json; charset=utf-8' } : {}),
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

const fail = (res, status, error) => send(res, status, { error });

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 5_000_000) throw Object.assign(new Error('body too large'), { status: 413 });
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error('invalid JSON body'), { status: 400 }); }
}

/** List view: drop heavy fields. */
function summary(l) {
  const e = l.enrichment || {};
  const th = l.score?.thesis || {};
  return {
    id: l.id, name: l.name, domain: l.domain, status: l.status, demo: Boolean(l.demo), hidden: Boolean(l.hidden),
    city: e.impressum?.city || l.signals.find((s) => s.data?.location)?.data.location || null,
    oneLiner: th.oneLiner || e.website?.description || l.signals.find((s) => s.data?.description)?.data.description || '',
    sector: th.sector || null, subsector: th.subsector || null,
    score: l.score ? { total: l.score.total, signal: l.score.signal.pts, thesis: th.pts, method: th.method } : null,
    sources: [...new Set(l.signals.map((s) => s.source))],
    families: [...new Set(l.signals.map((s) => familyOf(s.source)).filter(Boolean))],
    earliness: l.earliness ? { firstSeen: l.earliness.firstSeen, firstSeenLabel: l.earliness.firstSeenLabel, firstPress: l.earliness.firstPress, leadTimeDays: l.earliness.leadTimeDays, noPressYet: l.earliness.noPressYet, pressChecked: l.earliness.pressChecked, summary: l.earliness.summary } : null,
    enriched: Boolean(l.enrichedAt), createdAt: l.createdAt, updatedAt: l.updatedAt,
  };
}

async function listLeads(url) {
  const q = (url.searchParams.get('q') || '').toLowerCase().trim();
  const minScore = +(url.searchParams.get('minScore') || 0);
  const status = url.searchParams.get('status');
  const limit = Math.min(1000, +(url.searchParams.get('limit') || 300));
  const all = url.searchParams.get('all') === '1';
  let leads = (await store.listLeads()).map(summary);
  if (!all) leads = leads.filter((l) => !l.hidden);
  if (status && status !== 'all') leads = leads.filter((l) => l.status === status);
  if (minScore) leads = leads.filter((l) => (l.score?.total || 0) >= minScore);
  if (q) leads = leads.filter((l) => [l.name, l.domain, l.oneLiner, l.city, l.sector, l.subsector].some((v) => v && String(v).toLowerCase().includes(q)));
  leads.sort((a, b) => (b.score?.total ?? -1) - (a.score?.total ?? -1) || b.updatedAt.localeCompare(a.updatedAt));
  return { total: leads.length, leads: leads.slice(0, limit) };
}

async function stats() {
  const leads = (await store.listLeads()).filter((l) => !l.demo);
  const visible = leads.filter((l) => !l.hidden);
  const lead = visible.map((l) => l.earliness?.leadTimeDays).filter((d) => d != null && d >= 0).sort((a, b) => a - b);
  const bySource = {};
  for (const l of leads) for (const s of new Set(l.signals.map((x) => x.source))) bySource[s] = (bySource[s] || 0) + 1;
  const runs = await store.listRuns();
  return {
    leads: leads.length,
    startups: visible.length,
    hiddenNotStartup: leads.length - visible.length,
    scoreAbove60: visible.filter((l) => (l.score?.total || 0) >= 60).length,
    noPressYet: visible.filter((l) => l.earliness?.noPressYet).length,
    multiSource: visible.filter((l) => new Set(l.signals.map((s) => familyOf(s.source)).filter(Boolean)).size >= 2).length,
    enriched: leads.filter((l) => l.enrichedAt).length,
    medianLeadTimeDays: lead.length ? lead[Math.floor(lead.length / 2)] : null,
    bySource,
    sourceLabels: SOURCE_LABEL,
    demoLeads: (await store.listLeads()).filter((l) => l.demo).length,
    llm: llmLabel(),
    llmActive: llmProvider() !== 'none',
    tts: Boolean(config.elevenlabs.key),
    github: config.github.token ? 'token' : 'reduced (no token)',
    running: isRunning(),
    lastRun: runs[0] ? { id: runs[0].id, status: runs[0].status, startedAt: runs[0].startedAt, finishedAt: runs[0].finishedAt, counts: runs[0].counts } : null,
  };
}

/** POST /api/candidates: single object, array, or {items}. Each item is {text,...} or {name?, domain?, source?}. */
async function candidates(body, url) {
  const items = Array.isArray(body) ? body : Array.isArray(body.items) ? body.items : [body];
  const signals = [];
  const notes = [];
  for (const it of items.slice(0, 200)) {
    if (!it || typeof it !== 'object') continue;
    if (it.text && String(it.text).trim().length > 20) {
      const r = await signalsFromText(it);
      signals.push(...r.signals);
      notes.push(`${it.url || it.title || 'text'}: ${r.signals.length} ventures via ${r.method}${r.error ? ` (LLM error: ${r.error})` : ''}`);
      continue;
    }
    const domain = normDomain(it.domain || it.website || (it.name && /\.[a-z]{2,}$/i.test(it.name) && !/\s/.test(it.name) ? it.name : null));
    const name = it.name && !(domain && normDomain(it.name) === domain) ? cleanName(it.name) : null;
    if (!domain && !name) continue;
    signals.push(makeSignal({
      source: it.source || 'manual', type: it.source && it.source !== 'manual' ? (it.type || 'text_mention') : 'manual',
      name, domain, url: it.url || (domain ? `https://${domain}` : undefined), date: it.date,
      data: { description: it.description || null, title: it.title || null, note: it.note || null },
    }));
  }
  if (!signals.length) return { signals: 0, created: [], updated: [], processed: [], notes };
  const merged = await ingestSignals(signals);
  const created = [...merged.created];
  const updated = [...merged.updated];
  let processed = [];
  if (url.searchParams.get('process') !== '0') {
    // Enrich + score up to 5 leads right away (new first, then updated manual checks); the rest waits for the next run.
    const ids = [...created, ...updated].slice(0, 5);
    const leads = (await store.listLeads()).filter((l) => ids.includes(l.id));
    processed = (await processLeads(leads)).map(summary);
  }
  return { signals: signals.length, created, updated, processed, notes };
}

async function route(req, res, url) {
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const m = req.method;

  if (m === 'GET' && p === '/api/health') return send(res, 200, { ok: true, llm: llmLabel() });
  if (m === 'GET' && p === '/api/leads') return send(res, 200, await listLeads(url));
  if (m === 'GET' && p === '/api/stats') return send(res, 200, await stats());
  if (m === 'GET' && p === '/api/runs') return send(res, 200, { running: isRunning(), runs: (await store.listRuns()).slice(0, 20) });

  const leadMatch = p.match(/^\/api\/leads\/([\w-]+)$/);
  if (leadMatch) {
    const lead = await store.getLead(leadMatch[1]);
    if (!lead) return fail(res, 404, 'lead not found');
    if (m === 'GET') return send(res, 200, lead);
    if (m === 'PATCH') {
      const body = await readBody(req);
      if (body.status !== undefined) {
        if (!STATUSES.includes(body.status)) return fail(res, 400, `status must be one of ${STATUSES.join(', ')}`);
        lead.status = body.status;
      }
      if (body.notes !== undefined) lead.notes = String(body.notes).slice(0, 5000);
      await store.upsertLead(lead);
      return send(res, 200, lead);
    }
    if (m === 'POST' && url.searchParams.get('action') === 'refresh') {
      if (lead.demo) return fail(res, 400, 'demo leads are fictional and cannot be refreshed');
      const [done] = await processLeads([lead], { force: true });
      return send(res, 200, done);
    }
  }

  if (m === 'POST' && p === '/api/candidates') return send(res, 200, await candidates(await readBody(req), url));

  if (m === 'POST' && p === '/api/run') {
    if (isRunning()) return fail(res, 409, 'a run is already in progress');
    const body = await readBody(req);
    const q = (k) => body[k] ?? url.searchParams.get(k);
    const sources = q('sources');
    const runId = startRun({
      sources: Array.isArray(sources) ? sources : typeof sources === 'string' ? sources.split(',') : undefined,
      since: q('since') || undefined,
      noLlm: [true, 'true', '1'].includes(q('noLlm')),
      noEnrich: [true, 'true', '1'].includes(q('noEnrich')),
      limit: q('limit') ? +q('limit') : undefined,
    });
    return send(res, 202, { runId, status: 'running' });
  }

  if (p === '/api/briefing') {
    if (m === 'POST') return send(res, 200, await createBriefing());
    if (m === 'GET') return send(res, 200, (await latestBriefing()) || { none: true });
  }

  if (p.startsWith('/api/')) return fail(res, 404, 'unknown endpoint');

  // Static files
  if (m !== 'GET' && m !== 'HEAD') return fail(res, 405, 'method not allowed');
  const rel = p === '/' ? 'index.html' : decodeURIComponent(p.slice(1));
  const file = path.resolve(config.publicDir, rel);
  if (!file.startsWith(config.publicDir + path.sep)) return fail(res, 403, 'forbidden');
  fs.readFile(file, (err, data) => {
    if (err) return fail(res, 404, 'not found');
    send(res, 200, data, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    await route(req, res, url);
  } catch (e) {
    console.error('[api]', req.method, url.pathname, e);
    if (!res.headersSent) fail(res, e.status || 500, e.message);
  }
});

// A run that was in progress when the process stopped will never finish: mark it.
for (const r of await store.listRuns()) {
  if (r.status === 'running') await store.updateRun(r.id, { status: 'interrupted', finishedAt: new Date().toISOString() });
}

server.listen(config.port, () => {
  console.log(`[api] HTGF sourcing engine on http://localhost:${config.port}  (LLM: ${llmLabel()}, GitHub: ${config.github.token ? 'token' : 'reduced'}, TTS: ${config.elevenlabs.key ? 'ElevenLabs' : 'off'})`);
});
