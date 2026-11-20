// Enrich one lead. Every step fails gracefully; errors are stored on the lead.
import { enrichWebsite } from './website.js';
import { firstCertificate, rdapLookup } from './domain.js';
import { pressCheck } from './press.js';
import { cleanName, normName, domainLabel } from '../normalize.js';
import { discoverDomain } from './discover.js';

async function safe(errors, key, fn) {
  try {
    return await fn();
  } catch (e) {
    errors[key] = e.message;
    return undefined;
  }
}

/** @param {object} lead  @param {{force?: boolean}} opts  force re-fetches crt.sh/RDAP even if known. */
export async function enrichLead(lead, { force = false } = {}) {
  const prev = lead.enrichment || {};
  const errors = {};
  const e = { ...prev, errors };
  // Name-only lead: try to find its website first.
  if (!lead.domain && lead.name && !prev.discovery?.checkedAt) {
    await safe(errors, 'discovery', async () => {
      const r = await discoverDomain(lead.name);
      e.discovery = { checkedAt: new Date().toISOString(), found: r?.domain || null, how: r?.how || null, tried: r?.tried };
      if (r) {
        lead.domain = r.domain;
        lead.domainSource = `guessed from name, verified: ${r.how}`;
        const label = domainLabel(r.domain);
        if (label && !lead.aliases.includes(label)) lead.aliases.push(label);
      }
    });
  }
  const d = lead.domain;

  const tasks = [];
  if (d) {
    tasks.push(safe(errors, 'website', async () => {
      const r = await enrichWebsite(d);
      e.website = r.website;
      e.impressum = r.impressum;
      if (!r.website.ok) errors.website = r.website.error;
    }));
    // Dates don't move: skip slow crt.sh/RDAP when already known.
    if (force || !prev.cert?.checkedAt) tasks.push(safe(errors, 'cert', async () => { e.cert = await firstCertificate(d); }));
    if (force || !(prev.rdap?.checkedAt || prev.rdap?.skipped)) tasks.push(safe(errors, 'rdap', async () => { e.rdap = await rdapLookup(d); }));
  }
  await Promise.all(tasks);
  // A domain-only lead (e.g. from CT) gets its official name from the Impressum.
  const company = cleanName(e.impressum?.company || '');
  if (company && company.length <= 60 && (lead.nameRank || 0) < 4) {
    lead.name = company;
    lead.nameRank = 3;
    const slug = normName(company);
    if (slug && !lead.aliases.includes(slug)) lead.aliases.push(slug);
  }
  // Press after the website step: the Impressum may have given us the official company name.
  await safe(errors, 'press', async () => { e.press = await pressCheck(lead); });
  if (errors.press && prev.press && !prev.press.error) e.press = prev.press;
  else if (errors.press) e.press = { error: errors.press };

  if (!Object.keys(errors).length) delete e.errors;
  lead.enrichment = e;
  lead.enrichedAt = new Date().toISOString();
  return lead;
}
