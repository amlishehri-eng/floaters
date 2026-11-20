// One lead per company. Match by domain first, then by alias (name slug / domain label).
import { randomUUID } from 'node:crypto';
import { normDomain, normName, domainLabel, cleanName } from './normalize.js';
import { nameRank } from './signals.js';

export function newLead({ name, domain }) {
  const now = new Date().toISOString();
  return {
    id: 'ld_' + randomUUID().replace(/-/g, '').slice(0, 10),
    name: name || domain || 'unknown',
    nameRank: 0,
    domain: domain || null,
    aliases: [],
    signals: [],
    status: 'new',
    notes: '',
    createdAt: now,
    updatedAt: now,
    signalsUpdatedAt: now,
    enrichedAt: null,
    enrichment: {},
    score: null,
    demo: false,
  };
}

function sigKey(s) {
  return [s.source, s.type, s.url || '', normName(s.name) || '', s.domain || ''].join('|');
}

function addAlias(lead, alias) {
  if (alias && !lead.aliases.includes(alias)) lead.aliases.push(alias);
}

function aliasesOf(sig, domain) {
  const out = [];
  const n = normName(sig.name);
  if (n) out.push(n);
  const d = domainLabel(domain);
  if (d) out.push(d);
  return out;
}

/** Add a signal to a lead (dedupe by key, keep earliest date + newest data, upgrade the name). */
function attach(lead, sig) {
  const key = sigKey(sig);
  const existing = lead.signals.find((s) => sigKey(s) === key);
  let changed = false;
  if (existing) {
    if (sig.date && (!existing.date || sig.date < existing.date)) existing.date = sig.date;
    const before = JSON.stringify(existing.data);
    existing.data = { ...existing.data, ...sig.data };
    // "newOnPage" is sticky once true
    if (existing.data.newOnPage === false && JSON.parse(before || '{}').newOnPage) existing.data.newOnPage = true;
    changed = before !== JSON.stringify(existing.data);
  } else {
    lead.signals.push(sig);
    changed = true;
  }
  const rank = nameRank(sig);
  if (sig.name && rank > (lead.nameRank || 0)) {
    lead.name = cleanName(sig.name) || sig.name;
    lead.nameRank = rank;
  }
  if (changed) lead.signalsUpdatedAt = new Date().toISOString();
  return changed;
}

/** Move everything from `from` into `into` (used when a domain-less lead turns out to be the same company). */
function absorb(into, from) {
  for (const s of from.signals) attach(into, s);
  for (const a of from.aliases) addAlias(into, a);
  if (into.status === 'new' && from.status !== 'new') into.status = from.status;
  if (from.notes) into.notes = [into.notes, from.notes].filter(Boolean).join('\n');
  if (from.createdAt < into.createdAt) into.createdAt = from.createdAt;
  if ((from.nameRank || 0) > (into.nameRank || 0)) {
    into.name = from.name;
    into.nameRank = from.nameRank;
  }
}

/**
 * Merge signals into the lead list (mutates `leads`).
 * Returns { leads, created: Set<id>, updated: Set<id>, removed: Set<id> }.
 */
export function mergeSignals(leads, signals) {
  const byDomain = new Map();
  const byAlias = new Map();
  const index = (lead) => {
    if (lead.domain) byDomain.set(lead.domain, lead);
    for (const a of lead.aliases) if (!byAlias.has(a) || !byAlias.get(a).domain) byAlias.set(a, lead);
  };
  leads.forEach(index);

  const created = new Set();
  const updated = new Set();
  const removed = new Set();

  for (const raw of signals) {
    const domain = normDomain(raw.domain);
    const sig = { ...raw, domain: domain || undefined };
    const aliases = aliasesOf(sig, domain);
    if (!domain && !aliases.length) continue;

    let lead = domain ? byDomain.get(domain) : null;

    if (domain) {
      // Pull in domain-less leads that share an alias (e.g. incubator name-only listing).
      for (const a of aliases) {
        const other = byAlias.get(a);
        if (!other || other.domain || other === lead || removed.has(other.id)) continue;
        if (!lead) {
          lead = other;
          lead.domain = domain;
        } else {
          absorb(lead, other);
          removed.add(other.id);
          created.delete(other.id);
          updated.delete(other.id);
        }
      }
    } else {
      // Name-only signal: attach to any lead with that alias.
      for (const a of aliases) {
        const other = byAlias.get(a);
        if (other && !removed.has(other.id)) { lead = other; break; }
      }
    }

    if (!lead) {
      lead = newLead({ name: sig.name ? cleanName(sig.name) : null, domain });
      leads.push(lead);
      created.add(lead.id);
    }
    for (const a of aliases) addAlias(lead, a);
    if (domain && !lead.domain) lead.domain = domain;
    if (!lead.name || lead.name === 'unknown') lead.name = domain;
    if (attach(lead, sig) && !created.has(lead.id)) updated.add(lead.id);
    index(lead);
  }

  const kept = leads.filter((l) => !removed.has(l.id));
  leads.length = 0;
  leads.push(...kept);
  return { leads, created, updated, removed };
}

/** Merge leads that ended up with the same domain (e.g. after domain discovery). Returns removed ids. */
export function dedupeByDomain(leads) {
  const byDomain = new Map();
  const removed = new Set();
  for (const lead of leads) {
    if (!lead.domain) continue;
    const keep = byDomain.get(lead.domain);
    if (!keep) { byDomain.set(lead.domain, lead); continue; }
    // Keep the older lead (stable id), absorb the newer one.
    const [into, from] = keep.createdAt <= lead.createdAt ? [keep, lead] : [lead, keep];
    absorb(into, from);
    into.signalsUpdatedAt = new Date().toISOString();
    removed.add(from.id);
    byDomain.set(lead.domain, into);
  }
  if (removed.size) {
    const kept = leads.filter((l) => !removed.has(l.id));
    leads.length = 0;
    leads.push(...kept);
  }
  return removed;
}
