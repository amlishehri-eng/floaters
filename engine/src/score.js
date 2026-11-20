// Scoring: signal score 0-60 (rules), thesis score 0-40 (LLM, keyword fallback 0-20), earliness.
// Every point is stored as { key, pts, why } so the UI can explain it.
import { familyOf, SOURCE_LABEL } from './signals.js';
import { DAY, daysBetween, truncate } from './util.js';
import { completeJson, llmProvider, llmLabel } from './llm.js';

const GERMAN_LOCATION = /germany|deutschland|berlin|m[uü]nchen|munich|hamburg|karlsruhe|aachen|dresden|darmstadt|stuttgart|frankfurt|k[oö]ln|cologne|heidelberg|leipzig|bonn|hannover|n[uü]rnberg|nuremberg|freiburg|t[uü]bingen|jena|potsdam|garching|erlangen|mainz|bremen|d[uü]sseldorf|essen|dortmund|bochum|kiel|rostock|ulm|w[uü]rzburg|g[oö]ttingen|braunschweig|magdeburg|ilmenau|kaiserslautern|saarbr[uü]cken|regensburg|augsburg|paderborn|siegen|chemnitz|mannheim|wiesbaden|m[uü]nster|bielefeld|oldenburg|konstanz|bayreuth|passau|bamberg|halle|greifswald|l[uü]beck|ingolstadt/i;

export const isGermanLocation = (s) => GERMAN_LOCATION.test(String(s || ''));

const ageDays = (d) => (d ? (Date.now() - new Date(d)) / DAY : null);

function families(lead) {
  return [...new Set(lead.signals.map((s) => familyOf(s.source)).filter(Boolean))];
}

export function maxStars(lead) {
  let stars = 0;
  for (const s of lead.signals) if (s.source === 'github') stars = Math.max(stars, s.data?.stars || 0);
  return stars;
}

export function isGerman(lead) {
  const e = lead.enrichment || {};
  if (e.impressum?.germany) return { yes: true, why: `Impressum in ${e.impressum.city || 'Germany'}` };
  const loc = lead.signals.find((s) => isGermanLocation(s.data?.location));
  if (loc) return { yes: true, why: `GitHub location "${loc.data.location}"` };
  if (lead.domain?.endsWith('.de')) return { yes: true, why: '.de domain' };
  const inc = lead.signals.find((s) => s.source === 'incubator' || s.source === 'press_release' || s.source === 'idw');
  if (inc) return { yes: true, why: `listed by German institution (${SOURCE_LABEL[inc.source] || inc.source})` };
  return { yes: false };
}

/** Rule-based signal score, 0-60. */
export function signalScore(lead) {
  const parts = [];
  const add = (key, pts, why) => parts.push({ key, pts, why });
  const e = lead.enrichment || {};

  const fams = families(lead);
  if (fams.length) add('sources', Math.min(36, fams.length * 12), `${fams.length} independent source famil${fams.length > 1 ? 'ies' : 'y'}: ${fams.join(', ')}`);

  const certAge = ageDays(e.cert?.firstCert);
  const regAge = ageDays(e.rdap?.registered);
  if ((certAge != null && certAge <= 180) || (regAge != null && regAge <= 365)) {
    const why = certAge != null && certAge <= 180
      ? `new domain: first TLS cert ${Math.round(certAge)} days ago`
      : `new domain: registered ${Math.round(regAge)} days ago`;
    add('newDomain', 8, why);
  }
  const oldest = Math.max(certAge ?? -1, regAge ?? -1);
  if (oldest > 3 * 365) add('oldDomain', -6, `domain older than 3 years (${(oldest / 365).toFixed(1)}y)`);

  const de = isGerman(lead);
  if (de.yes) add('german', 6, `German: ${de.why}`);

  if (e.impressum?.inFounding) add('inFounding', 5, 'Impressum says "i.G." / in Gründung');
  if (e.impressum?.legalForm === 'UG (haftungsbeschränkt)' || e.impressum?.legalForm === 'UG') add('ug', 3, 'UG (haftungsbeschränkt): typical first legal form');

  const stars = maxStars(lead);
  if (stars > 0) {
    const pts = Math.min(6, Math.round(Math.log10(stars + 1) * 2.4));
    if (pts > 0) add('github', pts, `GitHub traction: ${stars} stars`);
  }

  const newOn = lead.signals.find((s) => s.source === 'incubator' && s.data?.newOnPage);
  if (newOn) add('newOnPage', 5, `newly added to ${newOn.data.pageTitle || 'incubator page'}`);

  const p = e.press;
  if (p && !p.skipped && !p.error) {
    if (p.fundingHeadlines?.length) add('funded', -15, `funding already in the news: "${truncate(p.fundingHeadlines[0].title, 70)}"`);
    else if (p.count === 0) add('noPress', 6, 'no press coverage yet');
    else if (p.count <= 3) add('littlePress', 3, `only ${p.count} press article${p.count > 1 ? 's' : ''}`);
  }

  if (e.website?.parked) add('parked', -10, 'domain is parked / for sale');
  else if (lead.domain && e.website && !e.website.ok) add('unreachable', -4, `website unreachable (${truncate(e.website.error || 'error', 40)})`);

  const sum = parts.reduce((a, b) => a + b.pts, 0);
  return { pts: Math.max(0, Math.min(60, sum)), parts };
}

// ---------- Thesis score ----------

export const HTGF_THESIS = `HTGF (High-Tech Gründerfonds) is Germany's most active pre-seed/seed investor.
Invests in tech startups, usually less than 3 years old, mostly based in Germany.
Sectors: Digital Tech (B2B software, AI, security), Industrial Tech (robotics, sensors, photonics, semiconductors, aerospace),
Climate & Deep Tech (energy, batteries, hydrogen, materials, quantum), Life Sciences (biotech, medtech, diagnostics), Chemistry.
Wants defensible technology, strong technical teams (often university spin-offs), and to meet founders before the first institutional round.
Not a fit: agencies, consultancies, shops, consumer apps without tech depth, student course projects, companies that already raised institutional money.`;

const SYSTEM = `You are a sceptical investment analyst at HTGF screening inbound leads. Judge ONLY from the evidence given; never invent facts.
If evidence is thin, say so and score low. Respond with a single JSON object and nothing else.

${HTGF_THESIS}`;

export function evidencePack(lead) {
  const e = lead.enrichment || {};
  const sigs = lead.signals.map((s) => {
    const d = s.data || {};
    const bits = [d.description, d.title, d.location && `location: ${d.location}`, d.stars && `${d.stars} stars`,
      d.topics?.length && `topics: ${d.topics.join(', ')}`, d.topRepos?.length && `repos: ${d.topRepos.map((r) => `${r.name} (${r.stars}★) ${r.description || ''}`).join(' | ')}`,
      d.founders && `founders: ${[].concat(d.founders).join(', ')}`, d.stage && `stage: ${d.stage}`, d.institution && `institution: ${d.institution}`,
      d.evidence && `quote: "${d.evidence}"`, d.pageTitle && `page: ${d.pageTitle}`, d.keyword && `cert keyword: ${d.keyword}`]
      .filter(Boolean).join('; ');
    return `- [${s.source}/${s.type}] ${s.name || s.domain || ''} (${s.date?.slice(0, 10)}): ${truncate(bits, 500)}`;
  });
  return [
    `Name: ${lead.name}`,
    `Domain: ${lead.domain || 'unknown'}`,
    `Signals:\n${sigs.join('\n')}`,
    e.website?.ok ? `Website title: ${e.website.title || ''}\nWebsite description: ${e.website.description || ''}\nWebsite text excerpt: ${truncate(e.website.text, 2500)}` : `Website: ${e.website?.parked ? 'parked' : e.website?.error || 'not checked'}`,
    e.impressum ? `Impressum: ${JSON.stringify({ company: e.impressum.company, legalForm: e.impressum.legalForm, inFounding: e.impressum.inFounding, register: e.impressum.register, court: e.impressum.court, city: e.impressum.city, directors: e.impressum.directors })}` : 'Impressum: not found',
    `First TLS certificate: ${e.cert?.firstCert?.slice(0, 10) || 'unknown'}; domain registered: ${e.rdap?.registered?.slice(0, 10) || 'unknown'}`,
    e.press && !e.press.skipped ? `Press: ${e.press.count} articles${e.press.items?.length ? '\n' + e.press.items.slice(0, 6).map((i) => `  - ${i.date?.slice(0, 10)} ${i.title}`).join('\n') : ''}` : 'Press: not checked',
  ].join('\n');
}

const THESIS_PROMPT = (pack) => `Evidence about a possible startup:
"""
${pack}
"""

Return JSON with exactly these keys:
{
  "isStartup": boolean (false for agencies, shops, consultancies, associations, research groups, student projects, personal pages, big corporates),
  "oneLiner": "what they build, max 20 words, English",
  "sector": one of "Digital Tech" | "Industrial Tech" | "Climate & Deep Tech" | "Life Sciences" | "Chemistry" | "Other",
  "subsector": "short",
  "germanyBased": boolean,
  "stage": one of "pre-founding" | "pre-seed" | "seed" | "series-a+" | "unknown",
  "alreadyFunded": boolean (true only if evidence shows an institutional round),
  "scores": { "sectorFit": 0-10, "techDepth": 0-10, "teamSignals": 0-10, "stageFit": 0-10 },
  "team": "what the evidence says about the team, or 'unknown'",
  "redFlags": ["short strings"],
  "whyHTGF": "1-2 sentences, evidence-based",
  "nextStep": "one concrete next step for an HTGF associate"
}`;

const clamp10 = (v) => Math.max(0, Math.min(10, Math.round(Number(v) || 0)));

export function applyMultipliers(base, r) {
  const mult = [];
  if (r.isStartup === false) mult.push({ x: 0.2, why: 'not a startup' });
  if (r.alreadyFunded === true) mult.push({ x: 0.5, why: 'already funded' });
  if (r.germanyBased === false) mult.push({ x: 0.6, why: 'not Germany-based' });
  const factor = mult.reduce((a, m) => a * m.x, 1);
  return { pts: Math.round(base * factor), multipliers: mult };
}

async function llmThesis(lead) {
  const r = await completeJson({ system: SYSTEM, prompt: THESIS_PROMPT(evidencePack(lead)), maxTokens: 4000, effort: 'medium' });
  const scores = r.scores || {};
  const s = { sectorFit: clamp10(scores.sectorFit), techDepth: clamp10(scores.techDepth), teamSignals: clamp10(scores.teamSignals), stageFit: clamp10(scores.stageFit) };
  const base = s.sectorFit + s.techDepth + s.teamSignals + s.stageFit;
  const { pts, multipliers } = applyMultipliers(base, r);
  return {
    method: 'llm', model: llmLabel(), pts: Math.min(40, pts), base, multipliers,
    isStartup: r.isStartup !== false, oneLiner: truncate(r.oneLiner || '', 200), sector: r.sector || 'Other', subsector: r.subsector || '',
    germanyBased: r.germanyBased, stage: r.stage || 'unknown', alreadyFunded: Boolean(r.alreadyFunded), scores: s,
    team: r.team || 'unknown', redFlags: Array.isArray(r.redFlags) ? r.redFlags.slice(0, 6).map(String) : [],
    whyHTGF: r.whyHTGF || '', nextStep: r.nextStep || '',
  };
}

const SECTORS = [
  ['Industrial Tech', 'robotics', /robot|sensor|lidar|photon|laser|optic|semicon|chip|fpga|embedded|aerospace|aero|satellit|space|drone|autonom|manufactur|machine vision|industrial|automation|digital twin|additive/i],
  ['Climate & Deep Tech', 'energy & materials', /batter|hydrogen|wasserstoff|electroly|fuel cell|energy|energie|solar|grid|carbon|climate|quantum|qubit|material|fusion|geotherm|heat pump|recycling/i],
  ['Life Sciences', 'bio & medtech', /bio|thera|diagnost|medtech|medical|clinical|drug|pharma|genom|protein|cell|patient|imaging|surg|implant|health/i],
  ['Chemistry', 'chemistry', /chem|catal|polymer|molecul|synthes|coating/i],
  ['Digital Tech', 'B2B software / AI / security', /\bai\b|machine learning|deep learning|llm|software|saas|platform|api|cyber|security|data|cloud|computer vision|b2b/i],
];
const DEPTH = /patent|spin-?off|ausgr[üu]ndung|research|forschung|prototype|prototyp|trl|phd|doktor|dr\.|prof\.|university|universit[äa]t|tum\b|kit\b|rwth|fraunhofer|max planck|helmholtz|exist|lab\b|laboratory|deep ?tech|hardware|algorithm/i;
const NOT_STARTUP = /agentur|agency|webdesign|online-?shop|restaurant|immobilien|kanzlei|steuerberat|arztpraxis|zahnarzt|hotel|friseur|fahrschule|e\.\s?v\.|verein|consulting|beratung|marketing|seo\b|druckerei|handwerk/i;

/** Keyword fallback when no LLM key: 0-20, conservative on purpose. */
export function keywordThesis(lead) {
  const e = lead.enrichment || {};
  // Only what the company says about itself (not its name/domain: "solar-kamen.de" is not evidence of deep tech).
  const text = [e.website?.title, e.website?.description, truncate(e.website?.text, 3000),
    ...lead.signals.flatMap((s) => [s.data?.description, s.data?.title, s.data?.keyword, ...(s.data?.topics || []),
      ...(s.data?.topRepos || []).map((r) => `${r.name} ${r.description || ''}`)])].filter(Boolean).join(' ');
  let best = null;
  for (const [sector, sub, re] of SECTORS) {
    const hits = (text.match(new RegExp(re.source, 'gi')) || []).length;
    if (hits && (!best || hits > best.hits)) best = { sector, sub, hits };
  }
  const depthHits = (text.match(new RegExp(DEPTH.source, 'gi')) || []).length;
  const negative = NOT_STARTUP.test(text) && !(best && best.hits >= 3);
  const young = (ageDays(e.cert?.firstCert) ?? 9999) < 540 || (ageDays(e.rdap?.registered) ?? 9999) < 730 || e.impressum?.inFounding || /^UG/.test(e.impressum?.legalForm || '');
  const funded = Boolean(e.press?.fundingHeadlines?.length);

  const s = {
    sectorFit: best ? Math.min(6, 2 + best.hits) : 0,
    techDepth: Math.min(6, depthHits * 2 + (maxStars(lead) >= 50 ? 2 : 0)),
    teamSignals: Math.min(4, (e.impressum?.directors?.length ? 2 : 0) + (lead.signals.some((s) => s.source === 'incubator' || s.data?.institution) ? 2 : 0)),
    stageFit: Math.min(4, (young ? 2 : 0) + (funded ? 0 : 2)),
  };
  const base = s.sectorFit + s.techDepth + s.teamSignals + s.stageFit; // max 20
  const de = isGerman(lead).yes;
  const r = { isStartup: !negative, alreadyFunded: funded, germanyBased: de ? true : (e.website?.ok ? false : undefined) };
  const { pts, multipliers } = applyMultipliers(base, r);
  const desc = e.website?.description || lead.signals.find((x) => x.data?.description)?.data.description || e.website?.title || '';
  const redFlags = [];
  if (negative) redFlags.push('website reads like a service business, not a tech startup');
  if (funded) redFlags.push('funding already reported');
  if (e.website?.parked) redFlags.push('parked domain');
  if (!e.website?.ok && lead.domain) redFlags.push('no reachable website');
  return {
    method: 'keywords', model: 'keyword fallback', pts: Math.min(20, pts), base, multipliers,
    isStartup: !negative, oneLiner: truncate(desc, 160), sector: best?.sector || 'Other', subsector: best?.sub || '',
    germanyBased: r.germanyBased, stage: funded ? 'seed' : young ? 'pre-seed' : 'unknown', alreadyFunded: funded,
    scores: s, team: e.impressum?.directors?.length ? `Managing directors (Impressum): ${e.impressum.directors.join(', ')}` : 'unknown',
    redFlags,
    whyHTGF: best ? `Keyword match for ${best.sector} (${best.hits} hits), tech-depth markers: ${depthHits}. Set an LLM key for a real analyst view.` : 'No clear sector match from keywords.',
    nextStep: lead.domain ? `Read ${lead.domain} and the Impressum, check the register entry manually.` : 'Find the company website first.',
  };
}

export async function thesisScore(lead, { useLlm = true } = {}) {
  if (useLlm && llmProvider() !== 'none') {
    try {
      return await llmThesis(lead);
    } catch (err) {
      const fb = keywordThesis(lead);
      fb.error = `LLM failed, keyword fallback used: ${err.message}`;
      return fb;
    }
  }
  return keywordThesis(lead);
}

// ---------- Earliness ----------

const TRACE_LABEL = {
  github_org: 'GitHub org created',
  github_repo: 'GitHub repo created',
  certificate: 'TLS cert seen in CT log',
  incubator_listing: 'Seen on incubator page',
  text_mention: 'Mentioned in text source',
  manual: 'Added manually',
};

export function earliness(lead) {
  const e = lead.enrichment || {};
  const timeline = [];
  for (const s of lead.signals) {
    if (!s.date || s.source === 'manual' || s.source === 'demo') continue;
    timeline.push({ date: s.date, label: TRACE_LABEL[s.type] || `${SOURCE_LABEL[s.source] || s.source} signal`, kind: 'trace', source: s.source });
  }
  if (e.cert?.firstCert) timeline.push({ date: e.cert.firstCert, label: 'First TLS certificate (crt.sh)', kind: 'trace', source: 'crtsh' });
  if (e.rdap?.registered) timeline.push({ date: e.rdap.registered, label: 'Domain registered (RDAP)', kind: 'trace', source: 'rdap' });
  timeline.push({ date: lead.createdAt, label: 'Detected by this engine', kind: 'detected' });
  const pressFirst = e.press && !e.press.skipped && !e.press.error ? e.press.firstDate : null;
  if (pressFirst) timeline.push({ date: pressFirst, label: 'First press article', kind: 'press' });
  timeline.sort((a, b) => a.date.localeCompare(b.date));

  const traces = timeline.filter((t) => t.kind === 'trace');
  const first = traces[0] || null;
  const pressChecked = Boolean(e.press && !e.press.skipped && !e.press.error);
  const noPressYet = pressChecked && !e.press.count;
  let leadTimeDays = null;
  if (first && pressFirst) leadTimeDays = daysBetween(first.date, pressFirst);
  else if (first && noPressYet) leadTimeDays = daysBetween(first.date, new Date());
  return {
    firstSeen: first?.date || null,
    firstSeenLabel: first?.label || null,
    detectedAt: lead.createdAt,
    firstPress: pressFirst,
    pressChecked,
    noPressYet,
    leadTimeDays,
    summary: !first ? 'no dated trace yet'
      : pressFirst ? (leadTimeDays >= 0 ? `seen ${leadTimeDays} days before first press` : `press came ${-leadTimeDays} days before first trace`)
        : noPressYet ? `first trace ${leadTimeDays} days ago, no press yet` : 'press not checked',
    timeline,
  };
}

/** Full score. Keeps a previous thesis result unless `rethink` (avoids paying for LLM calls on every pass). */
export async function scoreLead(lead, { rethink = true, useLlm = true } = {}) {
  const signal = signalScore(lead);
  let thesis = lead.score?.thesis;
  if (rethink || !thesis) thesis = await thesisScore(lead, { useLlm });
  const early = earliness(lead);
  lead.score = { total: signal.pts + thesis.pts, signal, thesis, computedAt: new Date().toISOString() };
  lead.earliness = early;
  lead.hidden = thesis.isStartup === false;
  return lead;
}

