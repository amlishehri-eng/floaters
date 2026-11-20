// Domain discovery for name-only leads (incubator cards, press releases).
// Guess slug x TLD, prune by DNS, keep a candidate only if its homepage names the company.
import dns from 'node:dns/promises';
import { httpGet, htmlToText } from '../util.js';
import { normName, cleanName } from '../normalize.js';

const TLDS = ['de', 'com', 'ai', 'io', 'tech', 'bio', 'eu', 'energy', 'health'];
const SUFFIX_WORDS = /\b(biotech|bio|ai|robotics|technologies|technology|tech|labs?|systems|solutions|therapeutics|diagnostics|energy|quantum|health|medical|gmbh|ug|ag)\b/gi;

export function domainCandidates(name) {
  const clean = cleanName(name);
  const out = new Set();
  // Names that already are domains ("Caire.ai", "DeepSynergy.AI")
  const m = clean.toLowerCase().match(/^([a-z0-9-]+)\.(ai|io|de|com|tech|bio|eu|app)$/);
  if (m) out.add(`${m[1]}.${m[2]}`);
  const base = clean.toLowerCase().replace(/\.(ai|io|de|com|tech|bio|eu|app)$/, '');
  const words = base.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').split(/[^a-z0-9]+/).filter(Boolean);
  const slugs = new Set([words.join(''), words.join('-')]);
  const core = base.replace(SUFFIX_WORDS, ' ').trim().split(/[^a-z0-9]+/).filter(Boolean);
  if (core.length && core.join('') !== words.join('') && core.join('').length >= 4) slugs.add(core.join(''));
  for (const s of slugs) {
    if (s.length < 3) continue;
    for (const t of TLDS) out.add(`${s}.${t}`);
  }
  return [...out].slice(0, 30);
}

async function resolves(host) {
  try {
    await Promise.race([dns.lookup(host), new Promise((_, rej) => setTimeout(() => rej(new Error('dns timeout')), 3000))]);
    return true;
  } catch {
    return false;
  }
}

async function verify(domain, slug) {
  try {
    const res = await httpGet(`https://${domain}/`, { timeout: 8000, accept: 'text/html' });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 400000);
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
    const desc = (html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)/i) || [])[1] || '';
    const head = normName(`${title} ${desc}`) || '';
    const body = normName(htmlToText(html).slice(0, 20000)) || '';
    if (/for sale|domain kaufen|parked|sedo|godaddy|hugedomains/i.test(title + html.slice(0, 5000))) return null;
    if (head.includes(slug)) return { domain, how: 'name in homepage title' };
    if (slug.length >= 6 && body.includes(slug)) return { domain, how: 'name on homepage' };
    return null;
  } catch {
    return null;
  }
}

/** Returns { domain, how, tried } or null. */
export async function discoverDomain(name) {
  const slug = normName(name);
  if (!slug || slug.length < 3) return null;
  const cands = domainCandidates(name);
  const live = [];
  await Promise.all(cands.map(async (c) => { if (await resolves(c)) live.push(c); }));
  live.sort((a, b) => cands.indexOf(a) - cands.indexOf(b));
  for (const d of live.slice(0, 8)) {
    const v = await verify(d, slug);
    if (v) return { ...v, tried: cands.length, resolved: live.length };
  }
  return null;
}
