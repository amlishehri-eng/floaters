import config from '../config.js';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const DAY = 86400000;

export function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / DAY);
}

export function isoDate(d) {
  const t = d ? new Date(d) : null;
  return t && !Number.isNaN(+t) ? t.toISOString() : null;
}

export function daysAgo(n) {
  return new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
}

/** fetch with timeout, user agent and optional retries. Throws on network error / timeout. */
export async function httpGet(url, { timeout = 15000, retries = 0, headers = {}, accept } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': config.userAgent, ...(accept ? { accept } : {}), ...headers },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeout),
      });
      return res;
    } catch (e) {
      lastErr = e;
      if (i < retries) await sleep(1500 * (i + 1));
    }
  }
  throw new Error(`${lastErr?.name === 'TimeoutError' ? 'timeout' : lastErr?.message || 'fetch failed'} (${shortUrl(url)})`);
}

export function shortUrl(u) {
  return String(u).replace(/^https?:\/\//, '').slice(0, 80);
}

/** Run async fn over items with limited concurrency. */
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export function decodeEntities(s) {
  return String(s)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü')
    .replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö').replace(/&Uuml;/g, 'Ü')
    .replace(/&szlig;/g, 'ß').replace(/&ndash;|&mdash;/g, '-')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

/** HTML -> text, keeping line breaks at block boundaries (needed for Impressum parsing). */
export function htmlToText(html) {
  return decodeEntities(
    String(html)
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer|address|dd|dt|table|ul|ol)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export function extractLinks(html, baseUrl) {
  const links = [];
  const re = /<a\b[^>]*?href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const href = new URL(decodeEntities(m[1]), baseUrl).toString();
      const text = htmlToText(m[2]).replace(/\s+/g, ' ').trim();
      links.push({ href, text });
    } catch { /* bad url */ }
  }
  return links;
}

export function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export const log = (scope, ...args) => console.log(`[${scope}]`, ...args);
export const warn = (scope, ...args) => console.warn(`[${scope}] WARN`, ...args);
