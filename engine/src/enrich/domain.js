// Domain age: first certificate (crt.sh) and registration date (RDAP).
import { httpGet } from '../util.js';

/** Earliest not_before for the domain on crt.sh. Slow: 30s timeout, 1 retry. */
export async function firstCertificate(domain) {
  const url = `https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`;
  const res = await httpGet(url, { timeout: 30000, retries: 1, accept: 'application/json' });
  if (!res.ok) throw new Error(`crt.sh HTTP ${res.status}`);
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
    checkedAt: new Date().toISOString(),
  };
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
