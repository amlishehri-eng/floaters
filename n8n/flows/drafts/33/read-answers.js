// Model answer -> the capital_need column (JSON): points 0-15, known, why, evidence [{ trace_id, url, quote }], unsupported.
// Code keeps only trace ids of this lead and a quote only when it really is in that trace. A known reading without
// valid evidence is marked unsupported (13 counts it 0). No readable answer: nothing is written, the lead is tried next run.
const MAX = 15;
const norm = s => String(s || '').toLowerCase().split('"').join('').split('“').join('').split('”').join('').split(/\s+/).join(' ').trim();
const out = [];
$input.all().forEach((item, i) => {
  let p; try { p = $('Pick leads').itemMatching(i).json; } catch (e) { p = $('Pick leads').all()[i].json; }
  let a = null;
  for (const o of (item.json && item.json.output) || []) for (const x of o.content || []) if (x.type === 'output_text') { try { a = JSON.parse(x.text); } catch (e) {} }
  if (!a) return;
  const byId = new Map((p.trace_meta || []).map(t => [t.id, t]));
  const evidence = [];
  for (const e of Array.isArray(a.evidence) ? a.evidence : []) {
    const t = byId.get(String(e && e.trace_id || '').trim());
    if (!t || evidence.some(x => x.trace_id === t.id) || evidence.length >= 2) continue;
    const q = String(e.quote || '').trim().slice(0, 200);
    const ok = q.length >= 8 && norm(t.text).includes(norm(q).slice(0, 120));
    evidence.push({ trace_id: t.id, url: t.url, quote: ok ? q : '' });
  }
  const known = a.known !== false;
  const points = known ? Math.max(0, Math.min(MAX, Math.round(Number(a.points) || 0))) : 0;
  const unsupported = known && !evidence.length;
  const u = item.json.usage || {};
  out.push({ json: { lead_key: p.lead_key,
    capital_need: JSON.stringify({ points, max: MAX, known, why: String(a.why || ''), evidence, ...(unsupported ? { unsupported: true } : {}), hash: p.hash, model: 'gpt-5-mini', checked_at: new Date().toISOString() }),
    _usage: { input: u.input_tokens || 0, output: u.output_tokens || 0 } } });
});
return out;
