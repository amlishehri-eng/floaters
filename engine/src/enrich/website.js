// Homepage (title, meta description, text, parked detection) + Impressum parsing.
import { httpGet, htmlToText, extractLinks, truncate, decodeEntities } from '../util.js';
import { parseImpressum, IMPRESSUM_LINK_RE } from '../impressum.js';
import { normDomain } from '../normalize.js';

const PARKED_RE = /domain (is |may be )?for sale|this domain (is|may be) for sale|buy this domain|domain kaufen|domain zu verkaufen|diese domain (steht zum verkauf|kann erworben)|sedo(parking)?\b|dan\.com|afternic|bodis|parkingcrew|hugedomains|undeveloped\.com|domain parking|parked (free|domain)|is parked|godaddy\.com\/domains|this page is parked|related searches|welcome to nginx|apache2? (ubuntu|debian)? ?default page|it works!|default web site page|index of \/|plesk|cpanel|domain registered at|wird in kürze|this site can.t be reached/i;
const PLACEHOLDER_RE = /coming soon|launching soon|under construction|im aufbau|hier entsteht|stay tuned|website in arbeit|demnächst|bald verfügbar|stealth/i;

function meta(html, name) {
  const re = new RegExp(`<meta[^>]+(?:name|property)\\s*=\\s*["']${name}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  const c = tag.match(/content\s*=\s*["']([^"']*)["']/i);
  return c ? decodeEntities(c[1]).trim() : null;
}

async function fetchPage(url) {
  const res = await httpGet(url, { timeout: 12000, accept: 'text/html,application/xhtml+xml' });
  const type = res.headers.get('content-type') || '';
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (type && !/html|text/.test(type)) throw new Error(`not html (${type})`);
  const html = (await res.text()).slice(0, 1_500_000);
  return { html, finalUrl: res.url };
}

async function findImpressum(html, baseUrl) {
  const links = extractLinks(html, baseUrl);
  const base = new URL(baseUrl);
  const candidates = [];
  for (const l of links) {
    let u;
    try { u = new URL(l.href); } catch { continue; }
    if (u.hostname.replace(/^www\./, '') !== base.hostname.replace(/^www\./, '')) continue;
    if (IMPRESSUM_LINK_RE.test(l.text) || IMPRESSUM_LINK_RE.test(u.pathname)) candidates.push(u.toString());
  }
  // Prefer German "impressum", then others; then guess common paths.
  candidates.sort((a, b) => (/impressum/i.test(b) ? 1 : 0) - (/impressum/i.test(a) ? 1 : 0));
  for (const p of ['/impressum', '/imprint', '/de/impressum', '/en/imprint', '/legal-notice', '/impressum.html']) candidates.push(new URL(p, base).toString());
  const tried = new Set();
  for (const url of candidates) {
    if (tried.has(url) || tried.size >= 4) continue;
    tried.add(url);
    try {
      const page = await fetchPage(url);
      const text = htmlToText(page.html);
      if (/impressum|imprint|legal notice|angaben gem[äa]ß|§\s?5\s?(tmg|ddg)|registergericht|handelsregister|gesch[äa]ftsf[üu]hrer|managing director/i.test(text)) {
        return { url: page.finalUrl || url, text };
      }
    } catch { /* try next */ }
  }
  return null;
}

export async function enrichWebsite(domain) {
  const out = { ok: false, checkedAt: new Date().toISOString() };
  let page;
  for (const url of [`https://${domain}/`, `https://www.${domain}/`, `http://${domain}/`]) {
    try {
      page = await fetchPage(url);
      out.url = page.finalUrl || url;
      break;
    } catch (e) {
      out.error = e.message;
    }
  }
  if (!page) return { website: out, impressum: null };

  const { html } = page;
  const text = htmlToText(html);
  out.ok = true;
  delete out.error;
  out.title = truncate(htmlToText((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' '), 160);
  out.description = truncate(meta(html, 'description') || meta(html, 'og:description') || '', 300);
  out.text = truncate(text.replace(/\n+/g, ' \n'), 4000);
  out.lang = (html.match(/<html[^>]+lang\s*=\s*["']([a-z-]+)/i) || [])[1] || null;
  const finalDomain = normDomain(out.url);
  if (finalDomain && finalDomain !== domain) out.redirectTo = finalDomain;
  out.parked = PARKED_RE.test(`${out.title} ${text.slice(0, 3000)}`) || (text.length < 40 && !/<a\s/i.test(html) && !/<script/i.test(html));
  out.placeholder = !out.parked && PLACEHOLDER_RE.test(`${out.title} ${text.slice(0, 1500)}`);
  out.jsOnly = !out.parked && text.length < 200 && /<script/i.test(html); // SPA: content rendered client-side

  let impressum = null;
  if (!out.parked) {
    const imp = await findImpressum(html, out.url);
    if (imp) {
      impressum = { url: imp.url, ...parseImpressum(imp.text) };
    } else if (/impressum|angaben gem[äa]ß/i.test(text)) {
      // single-page sites often have the Impressum inline
      impressum = { url: out.url, ...parseImpressum(text) };
    }
  }
  return { website: out, impressum };
}
