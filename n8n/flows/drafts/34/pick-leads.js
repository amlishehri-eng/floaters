// Team enrichment (scoring v3, Amli): leads that passed the gates with strong tech but thin team evidence, and a website.
// Their own website's team / about / Impressum pages become one extra trace, so 15 can judge the team on real evidence.
// Only leads never checked before (site_checked_at empty); best first (priority). Public pages only, robots.txt respected.
const MAX_PER_RUN = 100;
const TECH_SHARE_MIN = 0.72;   // tech_depth 18 of 25 or more, with evidence
const WANT = ['needs_enrichment', 'watchlist', 'call_now'];
const obj = s => { try { const v = typeof s === 'object' && s ? s : JSON.parse(s || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };
const share = c => (!c || c.known === false || c.unsupported || !(Number(c.max) > 0)) ? 0 : (Number(c.points) || 0) / Number(c.max);
const hostOf = s => { const m = String(s || '').trim().match(/^(?:https?:\/\/)?([^/?#:@\s]+)/i); return m ? m[1].toLowerCase() : null; };
const BAD_HOST = /(^|\.)(linkedin|xing|facebook|instagram|twitter|x|youtube|github|medium|notion|linktr|calendly|wixsite|webflow|tum|lmu|tum-venture-labs|munich-startup)\.[a-z.]+$/;
const picked = [];
for (const item of $input.all()) {
  const l = item.json;
  if (!l.lead_key || !WANT.includes(l.verdict) || l.site_checked_at) continue;
  const host = hostOf(l.website);
  if (!host || l.website === 'none' || BAD_HOST.test(host)) continue;
  if (share(obj(l.fit_breakdown).tech_depth) < TECH_SHARE_MIN) continue;
  const teamB = obj(l.team_breakdown);
  const unknownTeam = ['technical_founder', 'complementary_roles', 'worked_together', 'deep_research', 'earlier_startup'].filter(k => !teamB[k] || teamB[k].known === false).length;
  if (l.verdict === 'call_now' && unknownTeam < 3) continue;   // call_now with a known team does not need it
  picked.push({ l, host, unknownTeam });
}
picked.sort((a, b) => (Number(b.l.priority) || 0) - (Number(a.l.priority) || 0));
return picked.slice(0, MAX_PER_RUN).map(({ l, host }) => ({ json: {
  lead_key: l.lead_key, name: l.name, city: l.city || '', trace_ids: l.trace_ids || '', host,
  origin: 'https://' + host, home: /^https?:\/\//i.test(l.website) ? l.website : 'https://' + host + '/', robots: 'https://' + host + '/robots.txt',
} }));
