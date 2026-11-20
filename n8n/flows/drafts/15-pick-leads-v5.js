// Which leads get the strong model this run: survivors of the gates plus the gray zone, only when their evidence changed.
// v4 (fix package 4b): RESCORE test hook (re-score named leads once, whatever their verdict except hard kills), the lead's registry
// adjustment from flow 12 goes along so Compute scores keeps it.
// v5 (scoring v3, Amli): 50 per run when started by hand (batch re-score after 34 Team enrichment), 10 when called by 10 or 34.
// Leads with a fresh website trace from 34 (site:<host>) go first, then highest stage-1 fit.
let byHand = false; try { byHand = $('Run by hand').isExecuted; } catch (e) {}
const MAX_SMART_PER_RUN = byHand ? 50 : 10;   // leads scored by the strong model per run (10 in parallel)
const GRAY_TECH_MIN = 10, GRAY_TECH_MAX = 14;   // not_high_tech with stage-1 tech_depth 10-14 gets a second look
const ONLY_LEAD_KEYS = [];             // test hook: when not empty, only these leads (still respects the evidence hash unless FORCE)
const FORCE = false;                   // test hook: score even when the evidence hash did not change
// Test hook for a one-time re-score after a rubric change: these leads are scored again if their scored_at is older than
// RESCORE_BEFORE and their verdict is a survivor or not_high_tech. Keep RESCORE_KEYS [] in normal runs.
const RESCORE_KEYS = [];
const RESCORE_BEFORE = '2026-11-20T19:40:00Z';
const TRACE_CHARS = 2500, EVIDENCE_CHARS = 16000;
const SURVIVORS = ['call_now', 'watchlist', 'needs_enrichment'];
const split = (s, sep) => String(s || '').split(sep).map(x => x.trim()).filter(Boolean);
const obj = s => { try { const v = JSON.parse(s || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };
const djb2 = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const websiteChars = t => { const m = String(t.text || '').match(/^Website text \([^)]*\): ([\s\S]*?)(?:\nImpressum:|$)/m); return m ? m[1].length : 0; };
const traces = new Map($('Get traces').all().map(i => [i.json.trace_id, i.json]));
const picked = [];
for (const item of $('Get all leads').all()) {
  const l = item.json;
  if (!l.lead_key || (ONLY_LEAD_KEYS.length && !ONLY_LEAD_KEYS.includes(l.lead_key))) continue;
  const fitB = obj(l.fit_breakdown);
  const stage1 = l.score_version === 2 ? (fitB.stage1 || {}) : { fit: Number(l.fit_score) || 0, team: Number(l.team_score) || 0, tech_depth: fitB.tech_depth ? Number(fitB.tech_depth.points) : null };
  const gray = l.verdict === 'not_high_tech' && stage1.tech_depth != null && stage1.tech_depth >= GRAY_TECH_MIN && stage1.tech_depth <= GRAY_TECH_MAX;
  const rescore = RESCORE_KEYS.includes(l.lead_key) && (SURVIVORS.includes(l.verdict) || l.verdict === 'not_high_tech')
    && (!l.scored_at || new Date(l.scored_at) < new Date(RESCORE_BEFORE));
  if (!SURVIVORS.includes(l.verdict) && !gray && !rescore) continue;
  const ids = split(l.trace_ids, ',').sort();
  const ts = ids.map(id => traces.get(id)).filter(Boolean);
  const hash = djb2(ids.join(',') + '|' + ts.reduce((s, t) => s + websiteChars(t), 0));
  if (!FORCE && !rescore && l.score_version === 2 && l.evidence_hash === hash) continue;
  picked.push({ l, ts, hash, stage1, gray });
}
const enriched = p => p.ts.some(t => String(t.trace_id).startsWith('site:')) ? 1 : 0;
picked.sort((a, b) => (enriched(b) - enriched(a)) || ((b.stage1.fit || 0) - (a.stage1.fit || 0)));
const chosen = picked.slice(0, MAX_SMART_PER_RUN);
const readings = s => Object.entries(obj(s)).filter(([k, v]) => v && typeof v === 'object' && 'points' in v).map(([k, v]) => `${k} ${v.points}/${v.max ?? '?'}${v.known === false ? ' (unknown)' : ''}: ${v.why || ''}`).join('\n');
return chosen.map(({ l, ts, hash, stage1, gray }) => {
  let budget = EVIDENCE_CHARS;
  const traceText = ts.sort((a, b) => new Date(a.happened_at || a.found_at) - new Date(b.happened_at || b.found_at)).map(t => {
    const body = String(t.text || '').slice(0, Math.max(0, Math.min(TRACE_CHARS, budget))); budget -= body.length;
    return `--- TRACE ${t.trace_id} | source ${t.source} | date ${String(t.happened_at || t.found_at || '').slice(0, 10)} | ${t.title || ''}\nPeople: ${t.people || ''}\n${body}`;
  }).join('\n\n');
  const prompt = `LEAD: ${l.name} (${l.lead_key})\nWhat: ${l.what || ''}\nCity: ${l.city || ''} · Sector: ${l.sector || ''} · Stage: ${l.stage || ''} · Founded: ${l.founded_year || 'unknown'} · Website: ${l.website || 'unknown'}\nPeople: ${l.people || ''}\nQuotes:\n${l.quotes || '(none)'}\n\nSTAGE-1 READING (gpt-5-mini, one trace at a time; check it, do not copy it):\nfit ${stage1.fit} · team ${stage1.team} · tech_depth ${stage1.tech_depth ?? 'not scored'}\n${readings(l.fit_breakdown)}\n${readings(l.team_breakdown)}\n\nTRACE IDS you may cite as evidence: ${ts.map(t => t.trace_id).join(', ')}\n\nALL EVIDENCE (${ts.length} traces, oldest first):\n${traceText}`;
  const reg = obj(l.registry_signals).score_adjustment || {};
  return { json: { lead_key: l.lead_key, name: l.name, verdict_before: l.verdict, gray_zone: gray, stage1, evidence_hash: hash, prompt,
    // trace text up to what the model saw (TRACE_CHARS), so a quote is only accepted when the model could have read it
    trace_meta: ts.map(t => ({ id: t.trace_id, source: t.source, url: t.url || null, date: t.happened_at || t.found_at, title: t.title || '', people: t.people || '', text: String(t.text || '').slice(0, 6000) })),
    registry_adjustment: { fit: Number(reg.fit) || 0, team: Number(reg.team) || 0 },
    old: { fit_breakdown: l.fit_breakdown, quotes: l.quotes || '', fit_reason: l.fit_reason, team_reason: l.team_reason } } };
});
