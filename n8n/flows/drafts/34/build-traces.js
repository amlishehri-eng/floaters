// Fetched pages -> one trace per lead ('site:<host>', source 'website', status 'processed'), so 15 reads it as evidence.
// Team and Impressum text first (15 reads the first 2,500 characters of a trace), emails and phone numbers removed.
// Leads with less than 300 characters of useful text get no trace, only site_checked_at, so they are not fetched again.
const plans = $('Plan pages').all().map(i => i.json);
const leads = new Map($('Pick leads').all().map(i => [i.json.lead_key, i.json]));
const textOf = html => String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<(nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (x, n) => String.fromCharCode(Number(n)));
const scrub = s => s.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]').replace(/(\+|00)?\d[\d \/().-]{7,}\d/g, m => (m.replace(/\D/g, '').length >= 8 ? '[phone]' : m));
const lines = s => [...new Set(scrub(s).split('\n').map(x => x.replace(/\s+/g, ' ').trim()).filter(x => x.length > 2))];
const IMPRESSUM_KEEP = /(gesch(ä|ae)ftsf(ü|ue)hr|vertretungsberechtigt|managing director|ceo|cto|founder|gr(ü|ue)nder|inhaber|registergericht|amtsgericht|hrb|handelsregister|gmbh|ug \(|sitz)/i;
const by = new Map();
$input.all().forEach((item, i) => {
  const p = plans[i]; if (!p) return;
  const g = by.get(p.lead_key) || { team: [], impressum: [], about: [], home: p.home_text || '', urls: [] };
  const html = typeof item.json.data === 'string' ? item.json.data : '';
  if (p.kind !== 'skip' && html) {
    const ls = lines(textOf(html));
    if (p.kind === 'impressum') g.impressum.push(...ls.filter(x => IMPRESSUM_KEEP.test(x)).slice(0, 15));
    else if (p.kind === 'team') g.team.push(...ls.slice(0, 80));
    else if (p.kind === 'about') g.about.push(...ls.slice(0, 60));
    else g.about.push(...ls.slice(0, 60));
    g.urls.push(p.url);
  }
  by.set(p.lead_key, g);
});
const now = new Date().toISOString();
const out = [];
for (const [key, g] of by) {
  const l = leads.get(key); if (!l) continue;
  const parts = [];
  if (g.team.length) parts.push('Team page: ' + g.team.join(' | '));
  if (g.impressum.length) parts.push('Impressum: ' + g.impressum.join(' | '));
  if (g.about.length) parts.push('About: ' + g.about.join(' | '));
  if (g.home) parts.push('Home page: ' + scrub(g.home));
  const body = parts.join('\n').slice(0, 6000);
  const ok = body.replace(/\s+/g, '').length >= 300 && (g.team.length || g.impressum.length || g.about.length);
  const trace_id = 'site:' + l.host.replace(/^www\./, '');
  const ids = String(l.trace_ids || '').split(',').map(x => x.trim()).filter(Boolean);
  out.push({ json: { ok: !!ok, lead_key: key, trace_id, site_checked_at: now,
    trace_ids: ok && !ids.includes(trace_id) ? [...ids, trace_id].join(', ') : ids.join(', '),
    trace: { trace_id, source: 'website', url: g.urls[0] || l.home, happened_at: now, found_at: now,
      title: l.name + ': own website (team, about, Impressum)', text: 'Website text (team, about and Impressum pages, ' + now.slice(0, 10) + '): ' + body,
      people: '', org_name: l.name, city: l.city || '', status: 'processed', website: l.origin + '/' } } });
}
return out;
