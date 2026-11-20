// Press check via Google News RSS: how many articles, when the first one appeared, funding headlines.
import { httpGet, decodeEntities, htmlToText } from '../util.js';
import { isGenericName, normName, domainLabel } from '../normalize.js';

const FUNDING_RE = /finanzierung|finanzierungsrunde|investment|investiert|investor|raises?|raised|sammelt|seed|series [a-d]|serie [a-d]|millionen|mio\.?\s?(€|euro)|\b\d+([.,]\d+)?\s?(m|mn|million)\b|funding|kapital|pre-seed|business angel|wagniskapital|venture capital|vc-/i;

function parseRss(xml) {
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const tag = (t) => {
      const v = block.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1] || '';
      return decodeEntities(v.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim();
    };
    const date = tag('pubDate');
    items.push({
      title: htmlToText(tag('title')),
      url: tag('link'),
      source: htmlToText(tag('source')),
      date: date && !Number.isNaN(+new Date(date)) ? new Date(date).toISOString() : null,
    });
  }
  return items;
}

export async function pressCheck(lead) {
  const name = lead.name && lead.name !== lead.domain ? lead.name : null;
  const terms = [];
  if (name && !isGenericName(name)) terms.push(`"${name}"`);
  if (lead.domain) terms.push(`"${lead.domain}"`);
  if (!terms.length) return { skipped: true, reason: 'name too generic to search' };
  const q = terms.join(' OR ');
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=de&gl=DE&ceid=DE:de`;
  const res = await httpGet(url, { timeout: 15000, retries: 1 });
  if (!res.ok) throw new Error(`Google News HTTP ${res.status}`);
  const items = parseRss(await res.text()).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // A funding headline only counts if it names the company (avoids "Nova raises…" for a different Nova).
  const slugs = [normName(name), domainLabel(lead.domain)].filter((s) => s && s.length >= 4);
  const mentions = (t) => slugs.some((s) => normName(t)?.includes(s));
  const fundingHeadlines = items.filter((i) => FUNDING_RE.test(i.title) && mentions(i.title)).slice(0, 5);

  return {
    query: q,
    count: items.length,
    firstDate: items.find((i) => i.date)?.date || null,
    items: items.slice(0, 10),
    fundingHeadlines,
    searchUrl: `https://news.google.com/search?q=${encodeURIComponent(q)}&hl=de&gl=DE&ceid=DE:de`,
    checkedAt: new Date().toISOString(),
  };
}
