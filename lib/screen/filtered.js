// Filtered page (/proof/funnel/filtered): every company that stopped after the HTGF gates, with the reason as a plain
// sentence, short stats, flagged near misses and the reason strip. Pure functions; the components only render.
// Stages and reasons come from lowerFunnel() / dropReason() in ./funnel, so the counts match the funnel page exactly.
import { companyHref } from "./candidates";
import { VERDICTS } from "./criteria";
import { clip, decodeEntities, isNum } from "./format";
import { dropReason, lowerFunnel } from "./funnel";

const AGE_LIMIT_MONTHS = 36;
export const BRING_PREFIX = "brought back from the funnel: ";

export const STAGE_TABS = [
  { key: "gates", label: "Gates → scored" },
  { key: "scored", label: "Scored → after age and funding" },
  { key: "standing", label: "After the check → deep-checked" },
  { key: "deep", label: "Deep-checked → call now" },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const arr = (v) => (Array.isArray(v) ? v : []);
const text = (v) => (typeof v === "string" ? decodeEntities(v).trim() : "");
const isScored = (l) => Number(l.score_version) === 2;
const num = (v) => (isNum(v) ? Number(v) : null);

function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function monthsBetween(fromIso, toIso) {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return null;
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) m -= 1;
  return m;
}

export const yearsMonths = (m) => {
  const y = Math.floor(m / 12);
  const r = m % 12;
  return [y && `${y} ${y === 1 ? "year" : "years"}`, r && `${r} ${r === 1 ? "month" : "months"}`].filter(Boolean).join(" ") || "under a month";
};

/** Age facts: the register date when there is one (exact), else a founding year (approximate). */
export function ageOf(l, asOf) {
  const reg = obj(obj(l.age_check).register);
  const fromReason = String(l.verdict_reason || "").match(/registered (\d{4}-\d{2}-\d{2})/);
  const date = reg.registered_date || (l.registered_at ? String(l.registered_at).slice(0, 10) : "") || fromReason?.[1] || "";
  if (date) {
    const months = monthsBetween(date, asOf);
    return months === null ? null : { exact: true, date, months };
  }
  const year = num(obj(l.age_check).founded_year) ?? num(l.founded_year) ?? num(String(l.verdict_reason || "").match(/founded (\d{4})/)?.[1]);
  if (!year) return null;
  return { exact: false, year, months: Math.max(0, (new Date(asOf).getUTCFullYear() - year) * 12) };
}

/** Disclosed funding in €M: the amount in the too-late reason, the largest round found, or a figure in the evidence. */
export function disclosedEurM(l) {
  const r = String(l.verdict_reason || "").match(/EUR\s*([\d.]+)\s*M\s*disclosed/i);
  if (r) return Number(r[1]);
  const rounds = arr(obj(l.age_check).rounds).map((x) => num(x?.amount_eur_m)).filter((x) => x !== null);
  if (rounds.length) return Math.max(...rounds);
  const ev = text(l.funding_evidence).match(/(?:€|EUR|\$)\s*([\d]+(?:[.,]\d+)?)\s*(?:M\b|Mio|million|milion)/i);
  return ev ? Number(ev[1].replace(",", ".")) : null;
}

const eur = (m) => `€${Number.isInteger(m) ? m : m.toFixed(1).replace(/\.0$/, "")}M`;
const verdictLabel = (v) => VERDICTS.find((x) => x.key === v)?.label || String(v || "not classified").replace(/_/g, " ");
const techOf = (l) => {
  const t = obj(obj(l.fit_breakdown).tech_depth);
  return isNum(t.points) && isNum(t.max) && t.known !== false ? { points: Number(t.points), max: Number(t.max) } : null;
};
const leadInvestor = (l) => {
  const named = arr(obj(l.age_check).rounds).find((x) => x?.lead_investor && /seed|series|vc/i.test(x?.type || ""))?.lead_investor;
  return named || String(l.verdict_reason || "").match(/led by ([^,()"]+?)(?:\s*\(|,|"|\)|$)/i)?.[1]?.trim() || "";
};
const city = (c) => (!c || /^(deutschland|germany|de)$/i.test(String(c).trim()) ? "City not known" : String(c));

/** One plain sentence for why this company stopped. Court and HRB stay on the company page. */
export function reasonSentence(l, reason, asOf) {
  const age = ageOf(l, asOf);
  const fit = num(l.fit_score);
  switch (reason) {
    case "Older than three years":
      if (age?.exact) { const d = new Date(age.date); return `Registered ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${yearsMonths(age.months)} ago.`; }
      if (age) return `Founded ${age.year}, about ${Math.round(age.months / 12)} years ago.`;
      return "Older than three years.";
    case "Raised €3M or more": { const m = disclosedEurM(l); return m ? `${eur(m)} disclosed, over the €3M line.` : "Raised €3M or more."; }
    case "VC round found": { const inv = leadInvestor(l); return inv ? `Round led by ${clip(inv, 60)}.` : "A VC-led round was found."; }
    case "Outside HTGF's sectors": return `Sector ${l.sector || "other"}, outside HTGF's fields.`;
    case "Not based in Germany": return "Based outside Germany.";
    case "Already in HTGF's portfolio": return "Already an HTGF portfolio company.";
    case "Tech depth below the bar": { const t = techOf(l); return t ? `Tech depth ${t.points} of ${t.max}, the gate is 15 of 25.` : "Tech depth below the gate."; }
    case "Research or student team, no company yet": return "Research or student team, no company yet.";
    case "Not a startup": return "Not a startup by the evidence.";
    case "Not scored yet: too little evidence": return "Too little evidence for the strong model yet.";
    case "Not scored yet: founders unknown": return "No founder named in the sources yet.";
    case "Not scored yet: waiting for the strong model": return "Waiting for the strong model.";
    case "Fit below 55": return fit !== null ? `Fit ${Math.round(fit)}, call now starts at 55.` : "Fit below 55.";
    case "No outside proof yet": return "No pilot, patent, grant or prize found yet.";
    case "Age not known yet": return "No founding year or register date found yet.";
    case "Tech depth unknown: too little evidence": return "Tech depth unknown, too little evidence.";
    case "Team mostly unknown": { const m = String(l.verdict_reason || "").match(/(\d+) of (\d+) team criteria unknown/); return m ? `${m[1]} of ${m[2]} team criteria unknown.` : "Most team criteria unknown."; }
    case "Flight risk: high": return "Flight risk rated high in the deep check.";
    case "On the watchlist, not deep-checked yet": return "On the watchlist, not deep-checked yet.";
    case "Too late for a first round": return "Too late for a first round.";
    default: return `Now marked ${verdictLabel(l.verdict).toLowerCase()}.`;
  }
}

/** A short stat line for one reason group, from the data. */
function reasonStat(reason, leads, asOf) {
  if (reason === "Older than three years") {
    const exact = leads.map((l) => ageOf(l, asOf)).filter((a) => a?.exact).map((a) => a.months);
    if (exact.length) return `median ${yearsMonths(Math.round(median(exact)))} since register`;
    const any = leads.map((l) => ageOf(l, asOf)?.months).filter((m) => m !== undefined && m !== null);
    return any.length ? `median about ${Math.round(median(any) / 12)} years since founding` : "";
  }
  if (reason === "Raised €3M or more") { const m = median(leads.map(disclosedEurM).filter((x) => x !== null)); return m !== null ? `median ${eur(m)} disclosed` : ""; }
  if (reason === "VC round found") { const named = leads.filter((l) => leadInvestor(l)).length; return `${named} with a named lead investor`; }
  if (reason === "Tech depth below the bar") { const t = median(leads.map(techOf).filter(Boolean).map((x) => (x.points / x.max) * 25)); return t !== null ? `median tech depth ${Math.round(t)} of 25` : ""; }
  if (reason === "Team mostly unknown") {
    const u = median(leads.map((l) => num(String(l.verdict_reason || "").match(/(\d+) of \d+ team criteria unknown/)?.[1])).filter((x) => x !== null));
    return u !== null ? `median ${Math.round(u)} of 8 criteria unknown` : "";
  }
  const fits = leads.map((l) => num(l.fit_score)).filter((x) => x !== null);
  if (reason.startsWith("Not scored yet")) return fits.length ? `median first-read fit ${Math.round(median(fits))}` : "";
  return fits.length ? `median fit ${Math.round(median(fits))}` : "";
}

const HARD_GATE = { "Older than three years": "the age check", "Raised €3M or more": "the funding check", "VC round found": "the VC check", "Outside HTGF's sectors": "the sector check", "Not based in Germany": "the Germany check", "Tech depth below the bar": "the high-tech gate" };

/** Near-miss rules, in this order; the first that matches wins. Returns { rule, missedBy } or null. */
export function nearMiss(l, reason, asOf, teamTopQuarter) {
  const age = ageOf(l, asOf);
  if (reason === "Older than three years" && age?.exact) {
    const over = age.months - AGE_LIMIT_MONTHS;
    if (over > 0 && over <= 6) return { rule: "age over the limit by 6 months or less", missedBy: `Missed the age limit by ${over} ${over === 1 ? "month" : "months"}.` };
  }
  const m = disclosedEurM(l);
  if (reason === "Raised €3M or more" && m !== null && m >= 3 && m <= 4) return { rule: "disclosed funding €3M–€4M", missedBy: `${eur(m)}, just over the line.` };
  const fit = isScored(l) ? num(l.fit_score) : null;
  if (reason === "Fit below 55" && fit !== null && fit >= 50 && fit < 55) return { rule: "fit 50–54", missedBy: `Fit ${Math.round(fit)}, call now starts at 55.` };
  const team = num(l.team_score_known);
  if (HARD_GATE[reason] && isScored(l) && ((fit !== null && fit >= 65) || (team !== null && teamTopQuarter !== null && team >= teamTopQuarter))) {
    return fit !== null && fit >= 65
      ? { rule: "fit 65 or more, stopped by a hard gate", missedBy: `Fit ${Math.round(fit)}, stopped by ${HARD_GATE[reason]}.` }
      : { rule: "team score in the top quarter, stopped by a hard gate", missedBy: `Team ${Math.round(team)}, stopped by ${HARD_GATE[reason]}.` };
  }
  return null;
}

function stats(l, asOf) {
  const fit = num(l.fit_score);
  const team = num(l.team_score_known);
  const age = ageOf(l, asOf);
  const m = disclosedEurM(l);
  const fund = m !== null ? eur(m) : ({ none: "none named", angels: "angels", grants: "grants", seeking: "seeking", pre_seed: "pre-seed", seed_vc: "VC seed", series_a_plus: "Series A+" }[l.funding_status] || "not known");
  const tech = isScored(l) ? techOf(l) : null;
  return [
    { label: isScored(l) ? "Fit" : "First fit", value: fit !== null ? String(Math.round(fit)) : "not known", ring: fit !== null ? Math.round(fit) : null },
    { label: "Team", value: team !== null ? String(Math.round(team)) : "not known" },
    { label: "Age", value: age ? (age.exact ? yearsMonths(age.months) : `about ${Math.round(age.months / 12)} years`) : "not known" },
    { label: "Funding", value: fund },
    ...(tech ? [{ label: "Tech", value: `${tech.points} of ${tech.max}` }] : []),
  ];
}

/**
 * The whole page. stage: one of STAGE_TABS keys or "all"; reason: a reason label or "".
 * votes: Map lead_key -> latest vote (from latestVotes in lib/n8n.js), so cards know who is already a candidate.
 */
export function filteredPage(leads, { stage = "all", reason = "", asOf = new Date().toISOString(), votes = new Map() } = {}) {
  const { stages, problems } = lowerFunnel(leads);
  const byKey = Object.fromEntries(stages.map((s) => [s.key, s]));
  const current = STAGE_TABS.some((t) => t.key === stage) ? stage : "all";
  const tabs = [
    ...STAGE_TABS.map((t) => ({ ...t, count: byKey[t.key]?.dropped?.length || 0 })),
  ];
  tabs.push({ key: "all", label: "All stages", count: tabs.reduce((n, t) => n + t.count, 0) });
  const pool = (current === "all" ? STAGE_TABS.map((t) => t.key) : [current]).flatMap((k) =>
    (byKey[k]?.dropped || []).map((l) => ({ l, stage: k, reason: dropReason(l, k) })),
  );

  // Team top quarter across every scored live lead (the yardstick for "strong on team").
  const teams = leads.filter((l) => isScored(l) && isNum(l.team_score_known)).map((l) => Number(l.team_score_known)).sort((a, b) => b - a);
  const teamTopQuarter = teams.length >= 4 ? teams[Math.floor(teams.length / 4) - 1] : null;

  const groups = new Map();
  for (const p of pool) groups.set(p.reason, [...(groups.get(p.reason) || []), p.l]);
  const total = pool.length;
  const reasons = [...groups.entries()]
    .map(([r, ls]) => ({ reason: r, n: ls.length, pct: Math.max(2, Math.round((ls.length / Math.max(1, total)) * 100)), stat: reasonStat(r, ls, asOf), current: r === reason }))
    .sort((a, b) => b.n - a.n || a.reason.localeCompare(b.reason));

  const stageLabel = Object.fromEntries(stages.map((s) => [s.key, { from: s.label, to: s.next }]));
  const card = (p) => {
    const sentence = reasonSentence(p.l, p.reason, asOf);
    const vote = votes.get(p.l.id);
    return {
      key: p.l.id,
      href: companyHref(p.l.id),
      name: decodeEntities(p.l.name || p.l.id),
      sector: p.l.sector ? String(p.l.sector) : "Sector not known",
      city: city(p.l.city),
      reason: p.reason,
      sentence,
      stage: p.stage,
      stats: stats(p.l, asOf),
      isCandidate: vote?.vote === "up",
      bringReason: `${BRING_PREFIX}${sentence.replace(/\.$/, "")}`,
      sort: { fit: num(p.l.fit_score) ?? -1, age: ageOf(p.l, asOf)?.months ?? -1, name: String(p.l.name || "").toLowerCase() },
      near: nearMiss(p.l, p.reason, asOf, teamTopQuarter),
      between: stageLabel[p.stage],
    };
  };
  const cards = pool.map(card);
  const shown = reason ? cards.filter((c) => c.reason === reason) : cards;
  // Closest misses first (age, funding, fit 50-54), then strong-but-gated; inside a rule by fit.
  const RULE_ORDER = ["age over the limit by 6 months or less", "disclosed funding €3M–€4M", "fit 50–54", "fit 65 or more, stopped by a hard gate", "team score in the top quarter, stopped by a hard gate"];
  const allNear = cards.filter((c) => c.near).sort((a, b) => RULE_ORDER.indexOf(a.near.rule) - RULE_ORDER.indexOf(b.near.rule) || b.sort.fit - a.sort.fit);
  // Round-robin over the rules so every kind of near miss shows, closest rule first.
  const buckets = RULE_ORDER.map((r) => allNear.filter((c) => c.near.rule === r));
  const near = [];
  for (let i = 0; near.length < 6 && buckets.some((b) => b[i]); i += 1) for (const b of buckets) if (b[i] && near.length < 6) near.push(b[i]);
  return { tabs, current, reasons, total, cards: shown.sort((a, b) => b.sort.fit - a.sort.fit), near, nearAll: allNear.length, reason: groups.has(reason) ? reason : "", problems, teamTopQuarter };
}

/** For the company page banner and Candidates: why a lead stopped, or null when it did not stop after the gates. */
export function stoppedAt(leads, key, asOf) {
  const { stages } = lowerFunnel(leads);
  for (const s of stages) {
    const l = (s.dropped || []).find((x) => x.id === key);
    if (l) {
      const reason = dropReason(l, s.key);
      const sentence = reasonSentence(l, reason, asOf);
      return { from: s.label, to: s.next, reason, sentence, bringReason: `${BRING_PREFIX}${sentence.replace(/\.$/, "")}` };
    }
  }
  return null;
}

/** "Brought back, filtered for: <reason>" from a vote reason written by Bring to the front, else "". */
export function broughtBackLine(vote) {
  const r = String(vote?.reason || "");
  return vote?.vote === "up" && r.startsWith(BRING_PREFIX) ? `Brought back, filtered for: ${clip(r.slice(BRING_PREFIX.length), 140)}` : "";
}
