// Which leads get a capital-need reading this run: survivors of the gates (call_now, watchlist, needs_enrichment)
// whose reading is missing or whose evidence changed (hash of trace ids + what). One gpt-5-mini call per lead.
// capital_need = how much money the company needs before it can earn at scale; HTGF's first ticket is EUR 800k+.
const MAX_PER_RUN = 400;
const TRACE_CHARS = 1500, MAX_TRACES = 4;
const SURVIVORS = ['call_now', 'watchlist', 'needs_enrichment'];
const MODEL = 'gpt-5-mini';
const INSTRUCTIONS = [
  'You judge one early-stage startup for High-Tech Gruenderfonds (HTGF). HTGF\'s first investment in pre-seed and seed is EUR 800,000 or more, so a fitting startup needs a round of that size to reach its next milestone.',
  'Rate capital_need from 0 to 15: how much money this company needs before it can earn revenue at scale. Judge what they build, not how good they are.',
  '- 12 to 15: hardware, sensors, robotics, photonics, quantum, materials, chemistry, biotech, medtech, energy systems, space; clinical trials, certification or regulatory approval (MDR, FDA, aviation); a lab, pilot plant or production line; or a stated raise of EUR 800k or more.',
  '- 6 to 11: software that needs a team of engineers for one to two years, deep integration into regulated or industrial customers (hospitals, factories, banks), long enterprise sales cycles, expensive data or compute.',
  '- 0 to 5: can be built by one to three people within months with little money: apps, websites, marketplaces, agencies or consulting, thin wrappers around someone else\'s AI, small SaaS tools.',
  'known: false (points 0) if the evidence says nothing about what they build. Never invent facts.',
  'why: one line naming the concrete evidence. evidence: up to 2 items { trace_id, quote }; trace_id copied exactly from the TRACE IDS list, quote copied word for word from that trace (at most 200 characters). known true needs at least one evidence item.',
  'Write umlauts and sharp s as plain characters.'
].join('\n');
const SCHEMA = { type: 'object', additionalProperties: false, required: ['points', 'known', 'why', 'evidence'], properties: {
  points: { type: 'integer' }, known: { type: 'boolean' }, why: { type: 'string' },
  evidence: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['trace_id', 'quote'], properties: { trace_id: { type: 'string' }, quote: { type: 'string' } } } } } };
const split = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
const obj = s => { try { const v = typeof s === 'object' && s ? s : JSON.parse(s || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };
const djb2 = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const traces = new Map($('Get processed traces').all().map(i => [i.json.trace_id, i.json]));
const picked = [];
for (const item of $('Get all leads').all()) {
  const l = item.json;
  if (!l.lead_key || !SURVIVORS.includes(l.verdict)) continue;
  const ids = split(l.trace_ids).sort();
  const hash = djb2(ids.join(',') + '|' + (l.what || ''));
  if (obj(l.capital_need).hash === hash) continue;
  picked.push({ l, ids, hash });
}
picked.sort((a, b) => (Number(b.l.priority) || 0) - (Number(a.l.priority) || 0));
return picked.slice(0, MAX_PER_RUN).map(({ l, ids, hash }) => {
  const ts = ids.map(id => traces.get(id)).filter(Boolean).slice(0, MAX_TRACES);
  const fitB = obj(l.fit_breakdown);
  const tech = fitB.tech_depth && fitB.tech_depth.why ? 'Tech reading: ' + fitB.tech_depth.why : '';
  const text = ts.map(t => '--- TRACE ' + t.trace_id + ' | ' + (t.title || '') + '\n' + String(t.text || '').slice(0, TRACE_CHARS)).join('\n\n');
  const input = 'STARTUP: ' + l.name + '\nWhat: ' + (l.what || '') + '\nSector: ' + (l.sector || '') + ' | Stage: ' + (l.stage || '') + ' | City: ' + (l.city || '') +
    '\n' + tech + '\nQuotes:\n' + (l.quotes || '(none)') + '\n\nTRACE IDS: ' + ts.map(t => t.trace_id).join(', ') + '\n\nEVIDENCE:\n' + text;
  return { json: { lead_key: l.lead_key, name: l.name, hash,
    trace_meta: ts.map(t => ({ id: t.trace_id, url: t.url || null, text: String(t.text || '').slice(0, TRACE_CHARS) + ' ' + (t.title || '') })),
    body: { model: MODEL, instructions: INSTRUCTIONS, input, max_output_tokens: 2000, reasoning: { effort: 'low' },
      text: { format: { type: 'json_schema', name: 'capital_need', strict: true, schema: SCHEMA } } } } };
});
