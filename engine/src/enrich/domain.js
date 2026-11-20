// Domain age: first certificate (crt.sh) and registration date (RDAP).
import { httpGet, sleep } from '../util.js';

// crt.sh rate-limits hard (429) and is often overloaded: 2 lanes, spaced out,
// plus a circuit breaker (3 failures in a row -> skip crt.sh for 5 minutes, use Cert Spotter).
const LANES = 2;
const lanes = Array.from({ length: LANES }, () => Promise.resolve());
let nextLane = 0;
function throttled(fn) {
  const i = nextLane++ % LANES;
  const p = lanes[i].then(fn, fn);
  lanes[i] = p.then(() => sleep(1000), () => sleep(1000));
  return p;
}
let failures = 0;
let openUntil = 0;

async function crtsh(domain) {
  if (Date.now() < openUntil) throw new Error('crt.sh skipped (circuit open after repeated failures)');
  const url = `https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`;
  try {
    let res = await httpGet(url, { timeout: 30000, accept: 'application/json' });
    if (!res.ok) {
      await sleep(3000); // 1 retry
      res = await httpGet(url, { timeout: 30000, accept: 'application/json' });
    }
    if (!res.ok) throw new Error(`crt.sh HTTP ${res.status}`);
    failures = 0;
    return await parseCrtsh(res, domain);
  } catch (e) {
    if (++failures >= 3) openUntil = Date.now() + 5 * 60000;
    throw e;
  }
}

async function parseCrtsh(res, domain) {
  const text = await res.text();
  let rows;
  try { rows = JSON.parse(text); } catch { throw new Error('crt.sh returned non-JSON (overloaded?)'); }
  if (!Array.isArray(rows) || !rows.length) return { firstCert: null, certCount: 0, checkedAt: new Date().toISOString() };
  let first = null;
  for (const r of rows) {
    const nb = r.not_before ? r.not_before + (r.not_before.endsWith('Z') ? '' : 'Z') : null;
    if (nb && (!first || nb < first.not_before)) first = { ...r, not_before: nb };
  }
  return {
    firstCert: first ? new Date(first.not_before).toISOString() : null,
    firstIssuer: first?.issuer_name?.match(/O=([^,]+)/)?.[1] || null,
    certCount: rows.length,
    crtshUrl: `https://crt.sh/?q=${encodeURIComponent(domain)}`,
    source: 'crt.sh',
    checkedAt: new Date().toISOString(),
  };
}

/** Fallback: Cert Spotter (free, 100/h). Only lists unexpired certs, so the date is an upper bound. */
async function certspotter(domain) {
  const res = await httpGet(`https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(domain)}&include_subdomains=true`, { timeout: 20000, accept: 'application/json' });
  if (!res.ok) throw new Error(`certspotter HTTP ${res.status}`);
  const rows = await res.json();
  const first = rows.map((r) => r.not_before).filter(Boolean).sort()[0] || null;
  return {
    firstCert: first ? new Date(first).toISOString() : null,
    certCount: rows.length,
    crtshUrl: `https://crt.sh/?q=${encodeURIComponent(domain)}`,
    source: 'certspotter (unexpired certs only: upper bound)',
    checkedAt: new Date().toISOString(),
  };
}

/** Earliest certificate for the domain: crt.sh (serialised, 30s timeout, 1 retry), Cert Spotter as fallback. */
export async function firstCertificate(domain) {
  try {
    return await throttled(() => crtsh(domain));
  } catch (e) {
    try {
      const r = await certspotter(domain);
      r.note = `crt.sh failed (${e.message})`;
      return r;
    } catch {
      throw e;
    }
  }
}

/** Registration date via rdap.org. DENIC (.de) publishes no dates, so it is skipped. */
export async function rdapLookup(domain) {
  if (domain.endsWith('.de')) return { skipped: true, reason: '.de: DENIC publishes no registration dates' };
  const res = await httpGet(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { timeout: 15000, accept: 'application/rdap+json, application/json' });
  if (res.status === 404) return { found: false, checkedAt: new Date().toISOString() };
  if (!res.ok) throw new Error(`RDAP HTTP ${res.status}`);
  const j = await res.json();
  const ev = (a) => j.events?.find((e) => e.eventAction === a)?.eventDate || null;
  const registrar = j.entities?.find((e) => e.roles?.includes('registrar'));
  const regName = registrar?.vcardArray?.[1]?.find((v) => v[0] === 'fn')?.[3] || null;
  return {
    found: true,
    registered: ev('registration') ? new Date(ev('registration')).toISOString() : null,
    lastChanged: ev('last changed'),
    expires: ev('expiration'),
    registrar: regName,
    checkedAt: new Date().toISOString(),
  };
}
