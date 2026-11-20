// robots.txt + home page -> up to 3 pages per lead: Impressum (managing directors), team / founders, about.
// Only same-site links, never a path robots.txt disallows for all user agents. Pages are ordered round-robin across
// leads, so one site never gets two requests in the same batch (the fetch step waits 2 s between batches).
const KINDS = [
  ['team', /(team|founders?|gr(u|ü|ue)nder|people|wir-sind|who-we-are|management)/i],
  ['impressum', /(impressum|imprint|legal-notice|legal|anbieterkennzeichnung)/i],
  ['about', /(about|ueber-uns|uber-uns|über-uns|about-us|unternehmen|company|story|mission)/i],
];
const leads = $('Pick leads').all().map(i => i.json);
const homes = $('Fetch home').all();
const robotsAll = $('Fetch robots.txt').all();
const disallowedFor = txt => {
  const rules = []; let applies = false;
  for (const raw of String(txt || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
    const [k, ...rest] = line.split(':'); const v = rest.join(':').trim();
    if (/^user-agent$/i.test(k)) applies = v === '*';
    else if (applies && /^disallow$/i.test(k) && v) rules.push(v);
  }
  return rules;
};
const textOf = html => String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const plans = [];
leads.forEach((l, i) => {
  const robotsTxt = robotsAll[i] && typeof robotsAll[i].json.data === 'string' ? robotsAll[i].json.data : '';
  const rules = disallowedFor(/<html/i.test(robotsTxt) ? '' : robotsTxt);
  const blocked = path => rules.some(r => r === '/' || path.startsWith(r));
  const html = homes[i] && typeof homes[i].json.data === 'string' ? homes[i].json.data : '';
  if (blocked('/') || !html) { plans.push([{ lead_key: l.lead_key, kind: 'skip', url: l.robots, why: blocked('/') ? 'robots.txt disallows the site' : 'home page not reachable', home_text: '' }]); return; }
  const links = [];
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi; let m;
  while ((m = re.exec(html))) {
    let href = m[1].trim(); const label = textOf(m[2]).slice(0, 60);
    if (/^(mailto|tel|javascript):/i.test(href)) continue;
    if (href.startsWith('//')) href = 'https:' + href;
    if (href.startsWith('/')) href = l.origin + href;
    if (!/^https?:\/\//i.test(href)) href = l.origin + '/' + href.replace(/^\.\//, '');
    const hm = href.match(/^https?:\/\/([^/?#:]+)(\/[^?#]*)?/i); if (!hm) continue;
    const h = hm[1].toLowerCase().replace(/^www\./, ''), path = hm[2] || '/';
    if (h !== l.host.replace(/^www\./, '') || blocked(path) || /\.(pdf|jpg|png|zip)$/i.test(path)) continue;
    links.push({ href: href.split('#')[0], path, label });
  }
  const pages = [];
  for (const [kind, rx] of KINDS) {
    const hit = links.find(x => rx.test(x.path) || rx.test(x.label));
    if (hit && !pages.some(p => p.url === hit.href)) pages.push({ lead_key: l.lead_key, kind, url: hit.href });
  }
  const home_text = textOf(html).slice(0, 4000);
  plans.push(pages.length ? pages.map(p => ({ ...p, home_text })) : [{ lead_key: l.lead_key, kind: 'home', url: l.home, home_text }]);
});
const out = [];
for (let round = 0; round < 3; round++) for (const p of plans) if (p[round]) out.push({ json: p[round] });
return out;
