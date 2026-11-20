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

const SKIP_LINE = /^(read more|read less|mehr( erfahren)?|weiterlesen|learn more|show (more|less)|zur website|website|\||to top)$/i;
const NAV_WORD = /^(home|news|about us|contact|kontakt|events?|privacy|imprint|impressum|datenschutz|accessibility|newsletter|partners?|team|jobs|careers|login|log in|menu|search|labs?|offerings|application|design|system setting|light mode|dark mode)$|^(our|unsere|upcoming|past|next)\b|semester|summit|workshop|lunch|award|conference|meetup|\b20\d\d\b/i;
const EVENT_DESC = /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b|·|^(use|if you use) /i;
const isName = (l) => l && l.length >= 2 && l.length <= 45 && l.split(/\s+/).length <= 6 && !/[.:?!]$/.test(l) && !/[:?]/.test(l) && !NAV_WORD.test(l) && /[A-Za-zÄÖÜäöü]/.test(l);
const isDesc = (l) => l && l.length >= 20 && l.split(/\s+/).length >= 3 && !isFoundingLine(l) && !EVENT_DESC.test(l);
const isFoundingLine = (l) => /^(founding year|gr[üu]ndungsjahr|founded)\s*:?\s*(\d{4})$/i.test(l || '');

const NOT_VENTURE_NAME = /teams? we work with|selected teams|office|lounge|what it costs|register|apply|write a mail|^➤|education|network|ecosystem|workspace|\bhub$|\barea$|rooms?\b|support|location|facilit|equipment|program(me)?\b|ventures$|^(ai|biotech|healthcare|novel food|hospitality tech)$|^(write|apply|contact|join)\b|colab|printing$|forming$|processing$|resilience$|regenerative|\bin (healthcare|agrifood|medicine)$/i;
const VENTURE_VERB = /\b(develops?|developing|offers?|provides?|builds?|building|enables?|combines?|creates?|creating|grows?|pioneers?|pioneering|revolutioni[sz]es|empowers?|transforms?|specializ\w+|makes?|making|converting|turning|detecting|designs?|produces?|is (developing|building|creating))\b/i;

/** Does the description read like a company describing itself (not a process, event or section)? */
function looksLikeVenture(v) {
  const d = v.description || '';
  const first = d.split(/[\s,:']/)[0];
  if (/^[A-Z]{2,5}$/.test(first) && !v.name.toUpperCase().includes(first)) return false; // "SLA offers…" = a process
  const nameWord = v.name.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  return (nameWord.length >= 3 && d.toLowerCase().replace(/[^a-z0-9 ]/g, '').startsWith(nameWord.slice(0, 5)))
    || /^(we|wir)\b/i.test(d) || /^[A-Z][a-z]+ing\b/.test(d) || VENTURE_VERB.test(d.slice(0, 80));
}

/**
 * No-LLM extraction from listing pages: runs of "Name / one-sentence description" cards (>= 3 in a row)
 * and "Name / Founding year: 2024 / tags" cards (TUM Start-up Wall).
 */
export function cardExtract(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !SKIP_LINE.test(l));
  const out = [];
  let run = [];
  const flush = () => {
    if (run.length >= 3) {
      // Keep a venture if it reads like one, or if most of its run does (then only the name filter applies).
      const ok = run.filter((v) => v.foundingYear || looksLikeVenture(v));
      const majority = ok.length >= run.length / 2;
      out.push(...run.filter((v) => !NOT_VENTURE_NAME.test(v.name) && (majority || ok.includes(v))));
    }
    run = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i];
    const b = lines[i + 1];
    if (isName(a) && isFoundingLine(b)) {
      const year = +b.match(/(\d{4})/)[1];
      const tags = [];
      let j = i + 2;
      while (j < lines.length && tags.length < 6 && !isFoundingLine(lines[j + 1]) && lines[j].length <= 40) {
        if (lines[j] !== '|') tags.push(lines[j]);
        j++;
      }
      run.push({ name: a, website: null, description: tags.length ? tags.join(', ') : null, founders: [], stage: null, foundingYear: year });
      i = j - 1;
      continue;
    }
    if (isName(a) && isDesc(b) && !isName(b.split(' ').length <= 6 ? b : '')) {
      run.push({ name: a, website: null, description: truncate(b, 240), founders: [], stage: null });
      i++;
      continue;
    }
    flush();
  }
  flush();
  return out;
}

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
      if (!ventures) {
        method = 'cards';
        ventures = cardExtract(text);
        // Attach websites by anchor text; add linked ventures the card parser missed.
        const linked = linkFallback(links, pageHost);
        for (const v of ventures) {
          const hit = linked.find((l) => l.name && normName(l.name) === normName(v.name));
          if (hit) v.website = hit.website;
        }
        if (!ventures.length) { ventures = linked.filter((l) => l.name && !NOT_VENTURE_NAME.test(l.name)); method = 'links'; }
      }
      // HTGF invests in companies < 3 years old: skip old entries on long-running walls.
      const minYear = new Date().getFullYear() - 3;
      ventures = ventures.filter((v) => !v.foundingYear || v.foundingYear >= minYear);

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
            stage: v.stage || null, foundingYear: v.foundingYear || null, newOnPage: isNew, extractedBy: method,
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
