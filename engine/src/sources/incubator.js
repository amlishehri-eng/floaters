// Incubator / university start-up pages: fetch, strip HTML, extract ventures (LLM, or external links without a key).
// Remembers who was listed on each page; ventures that appear later get data.newOnPage = true.
import config from '../../config.js';
import store from '../store.js';
import { makeSignal } from '../signals.js';
import { httpGet, htmlToText, extractLinks, truncate, log } from '../util.js';
import { normDomain, normName, cleanName } from '../normalize.js';
import { completeJson, llmProvider } from '../llm.js';

const SYSTEM = 'You extract start-up listings from university incubator web pages. Only list ventures that are actually on the page. Respond with JSON only.';

const PROMPT = (url, text, links) => `Page: ${url}
Text (truncated):
"""
${truncate(text, 14000)}
"""
External links on the page (anchor text -> url):
${links.slice(0, 150).map((l) => `- ${truncate(l.text, 60)} -> ${l.href}`).join('\n')}

Return {"ventures": [{"name": "...", "website": "https://... or null", "description": "max 25 words or null", "founders": ["only if named on the page"], "stage": "if stated, else null"}]}.
Match each venture to its website from the links when obvious. Skip partners, sponsors, investors, universities and navigation links.`;

function linkFallback(links, pageHost) {
  const out = [];
  const seen = new Set();
  for (const l of links) {
    const d = normDomain(l.href);
    if (!d || seen.has(d)) continue;
    let host;
    try { host = new URL(l.href).hostname; } catch { continue; }
    if (host.endsWith(pageHost) || /tum\.de|unternehmertum|lmu\.de|google|bayern|europa\.eu|bund\.de|cookie|privacy|datenschutz/i.test(l.href)) continue;
    const name = l.text && l.text.length >= 2 && l.text.length <= 40 && !/^(website|homepage|mehr|more|link|www\.|http|zur website|visit)/i.test(l.text) ? l.text : null;
    seen.add(d);
    out.push({ name: name || null, website: l.href, description: null, founders: [], stage: null });
  }
  return out;
}

export async function collectIncubators({ pages = config.incubatorPages } = {}) {
  const signals = [];
  const notes = [];
  const errors = [];
  const seenByPage = await store.getMeta('incubatorSeen', {});

  for (const url of pages) {
    try {
      const res = await httpGet(url, { timeout: 25000, retries: 1 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const title = truncate(htmlToText((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || url).replace(/\s+/g, ' '), 90);
      const text = htmlToText(html);
      const pageHost = new URL(url).hostname.replace(/^www\./, '');
      const links = extractLinks(html, url).filter((l) => { try { return !new URL(l.href).hostname.endsWith(pageHost); } catch { return false; } });

      let ventures;
      let method = 'links';
      if (llmProvider() !== 'none') {
        try {
          const r = await completeJson({ system: SYSTEM, prompt: PROMPT(url, text, links), maxTokens: 8000 });
          ventures = Array.isArray(r) ? r : r.ventures || [];
          method = 'llm';
        } catch (e) {
          errors.push(`${url}: LLM extraction failed (${e.message}), using links`);
        }
      }
      if (!ventures) ventures = linkFallback(links, pageHost);

      const prev = seenByPage[url];
      const firstVisit = !prev;
      const page = prev || { firstSeen: {}, baseline: new Date().toISOString() };
      let newCount = 0;
      for (const v of ventures) {
        const domain = normDomain(v.website);
        const key = normName(v.name) || domain;
        if (!key) continue;
        const isNew = !firstVisit && !page.firstSeen[key];
        if (!page.firstSeen[key]) page.firstSeen[key] = new Date().toISOString();
        if (isNew) newCount++;
        signals.push(makeSignal({
          source: 'incubator', type: 'incubator_listing', name: v.name ? cleanName(v.name) : null, domain, url,
          date: page.firstSeen[key],
          data: {
            page: url, pageTitle: title, description: v.description || null,
            founders: Array.isArray(v.founders) ? v.founders.filter(Boolean).slice(0, 6) : [],
            stage: v.stage || null, newOnPage: isNew, extractedBy: method,
          },
        }));
      }
      seenByPage[url] = page;
      const msg = `${title}: ${ventures.length} ventures via ${method}${firstVisit ? ' (baseline, nothing marked new)' : `, ${newCount} new on page`}`;
      log('incubator', msg);
      notes.push(msg);
    } catch (e) {
      errors.push(`${url}: ${e.message}`);
    }
  }
  await store.setMeta('incubatorSeen', seenByPage);
  return { signals, log: notes, errors };
}
