// Spoken top-5 briefing: picks the leads and writes the script from a template (no model call).
// Pure functions, no "@/" imports, so scripts and node tests can load this file directly.
import { createHash } from "node:crypto";

export const TOP_N = 5;
// ~150 spoken words per minute: 150 words keeps the briefing at about 60 seconds.
export const MAX_WORDS = 150;
const WORDS_PER_SECOND = 2.5;

const SHOWN_VERDICTS = ["call_now", "watchlist", "needs_enrichment"];
const VERDICT_RANK = { call_now: 0, watchlist: 1, needs_enrichment: 2 };

const num = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const text = (v) => (typeof v === "string" ? v.trim() : "");
const truthy = (v) => v === true || v === "true";
const words = (s) => s.split(/\s+/).filter(Boolean).length;

function hidden(lead) {
  const status = text(lead.status);
  const verdict = text(lead.verdict);
  const markers = [status, verdict, text(lead.lead_type), text(lead.tier_reason)];
  if (status.startsWith("merged_into:") || verdict === "merged") return true;
  if (verdict === "too_late" || verdict.startsWith("not_")) return true;
  if (markers.some((m) => m.includes("htgf_portfolio"))) return true;
  return !SHOWN_VERDICTS.includes(verdict);
}

// Ahead of the press (or still invisible) is the pitch, so it breaks ties within one priority.
function isAhead(lead) {
  return truthy(lead.still_invisible) || (num(lead.days_ahead) ?? 0) > 0;
}

/** call_now first, then by priority; ties: ahead of the press, fit, days ahead. */
export function pickTop(leads, n = TOP_N) {
  return (leads || [])
    .filter((l) => l && (l.lead_key || l.id) && !hidden(l))
    .sort(
      (a, b) =>
        (a.verdict === "call_now" ? 0 : 1) - (b.verdict === "call_now" ? 0 : 1) ||
        (num(b.priority) ?? 0) - (num(a.priority) ?? 0) ||
        Number(isAhead(b)) - Number(isAhead(a)) ||
        VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict] ||
        (num(b.fit_score) ?? 0) - (num(a.fit_score) ?? 0) ||
        (num(b.days_ahead) ?? -1e9) - (num(a.days_ahead) ?? -1e9),
    )
    .slice(0, n);
}

// Too long: cut before the last connecting word ("for", "to", "using", ...) that keeps it under the limit,
// so "Lab-precise sensors combining remote data ..." becomes "Lab-precise sensors".
const BREAK = /^(for|to|with|using|powered|combining|that|which|by|via|based|in|on|from|and|für|zur|zum|bei|mit|durch|von|und)$/i;
function shorten(s, maxWords) {
  const w = text(s).replace(/[.…]+$/, "").split(/\s+/).filter(Boolean);
  if (w.length <= maxWords) return w.join(" ");
  let cut = maxWords;
  for (let i = Math.min(maxWords, w.length - 1); i >= 2; i--) {
    if (BREAK.test(w[i])) {
      cut = i;
      break;
    }
  }
  const kept = w.slice(0, cut);
  while (kept.length > 2 && BREAK.test(kept.at(-1))) kept.pop();
  return kept.join(" ").replace(/[,;:]$/, "");
}

// First clause of "what", short, so one lead stays one breath.
function shortWhat(what, maxWords) {
  return shorten(text(what).split(/;|\s[–-]\s|\.\s|,\s(?:using|with|that|which|by)\s/)[0].replace(/\s*\([^)]*\)/g, ""), maxWords);
}

const fmt = (n, lang) => (n === null ? "" : n.toLocaleString(lang === "de" ? "de-DE" : "en-US"));

const T = {
  en: {
    ordinals: ["Number one", "Number two", "Number three", "Number four", "Number five"],
    city: (c) => ({ München: "Munich", Köln: "Cologne", Nürnberg: "Nuremberg" })[c] || c,
    opening: (f) =>
      [
        f.traces !== null && `We read ${fmt(f.traces, "en")} public traces`,
        f.leads !== null && `${fmt(f.leads, "en")} became leads`,
        f.survivors !== null && `${fmt(f.survivors, "en")} passed every gate`,
        f.call_now !== null && `${fmt(f.call_now, "en")} ${f.call_now === 1 ? "is" : "are"} worth a call now`,
      ]
        .filter(Boolean)
        .join(", ")
        .replace(/, ([^,]*)$/, ", and $1") + ".",
    noFunnel: "Here are today's top leads.",
    top: (n) => `Today's top ${n}.`,
    from: (name, city) => (city ? `${name}, ${city}.` : `${name}.`),
    why: {
      call_now: (l) => `Worth a call: fit ${l.fit}${l.team !== null ? `, team ${l.team}` : ""}.`,
      watchlist: (l) => `On the watchlist with fit ${l.fit}.`,
      needs_enrichment: (l) =>
        l.unknownTeam === 5 || l.unknownTeam === "all"
          ? `Fit ${l.fit}, team still unknown.`
          : l.unknownTeam
            ? `Fit ${l.fit}, ${l.unknownTeam} of 5 team criteria open.`
            : `Fit ${l.fit}, team needs a closer look.`,
    },
    invisible: (d) => (d > 0 ? `Still invisible: no press ${d} days after our first trace.` : "Still invisible: no press yet."),
    ahead: (d) => `We found them ${d} days before the press.`,
    next: (s) => `Next step: ${s}.`,
    flight: (r) => `Flight risk ${r}.`,
    funding: (s) => `Funding: ${s}.`,
    age: (s) => `Note: ${s}.`,
    closing: "That's the briefing.",
  },
  de: {
    ordinals: ["Nummer eins", "Nummer zwei", "Nummer drei", "Nummer vier", "Nummer fünf"],
    city: (c) => ({ Munich: "München", Cologne: "Köln", Nuremberg: "Nürnberg" })[c] || c,
    opening: (f) =>
      [
        f.traces !== null && `Wir haben ${fmt(f.traces, "de")} öffentliche Spuren gelesen`,
        f.leads !== null && `${fmt(f.leads, "de")} wurden Leads`,
        f.survivors !== null && `${fmt(f.survivors, "de")} haben alle Prüfungen bestanden`,
        f.call_now !== null && `${fmt(f.call_now, "de")} ${f.call_now === 1 ? "ist" : "sind"} jetzt einen Anruf wert`,
      ]
        .filter(Boolean)
        .join(", ")
        .replace(/, ([^,]*)$/, " und $1") + ".",
    noFunnel: "Hier sind die besten Leads von heute.",
    top: (n) => `Die Top ${n} von heute.`,
    from: (name, city) => (city ? `${name} aus ${city}.` : `${name}.`),
    why: {
      call_now: (l) => `Einen Anruf wert: Fit ${l.fit}${l.team !== null ? `, Team ${l.team}` : ""}.`,
      watchlist: (l) => `Auf der Watchlist mit Fit ${l.fit}.`,
      needs_enrichment: (l) =>
        l.unknownTeam === 5 || l.unknownTeam === "all"
          ? `Fit ${l.fit}, Team noch unbekannt.`
          : l.unknownTeam
            ? `Fit ${l.fit}, ${l.unknownTeam} von 5 Teamkriterien offen.`
            : `Fit ${l.fit}, Team braucht einen zweiten Blick.`,
    },
    invisible: (d) => (d > 0 ? `Noch unsichtbar: keine Presse, ${d} Tage nach unserer ersten Spur.` : "Noch unsichtbar: noch keine Presse."),
    ahead: (d) => `Wir haben sie ${d} Tage vor der Presse gefunden.`,
    next: (s) => `Nächster Schritt: ${s}.`,
    flight: (r) => `Abwanderungsrisiko ${r}.`,
    funding: (s) => `Finanzierung: ${s}.`,
    age: (s) => `Hinweis: ${s}.`,
    closing: "Das war das Briefing.",
  },
};

// verdict_reason is written for people reading a table ("3 of 5 team criteria unknown: ...").
function unknownTeam(lead) {
  const reason = text(lead.verdict_reason);
  if (/no team criterion known/i.test(reason)) return "all";
  const m = reason.match(/(\d)\s+of\s+5\s+team criteria unknown/i);
  return m ? Number(m[1]) : null;
}

const EMPTY = /^(none|unknown|null|no|n\/a|-)?$/i;

function leadSegment(lead, i, t, whatWords) {
  const l = { fit: num(lead.fit_score) ?? 0, team: num(lead.team_score_known) ?? num(lead.team_score), unknownTeam: unknownTeam(lead) };
  const core = [`${t.ordinals[i]}: ${t.from(text(lead.name) || lead.lead_key, t.city(text(lead.city)))}`];
  const what = shortWhat(lead.what, whatWords);
  if (what) core.push(`${what}.`);
  core.push((t.why[lead.verdict] || t.why.watchlist)(l));
  // Earliness is the pitch, so it is part of the core.
  const days = num(lead.days_ahead);
  if (truthy(lead.still_invisible)) core.push(t.invisible(days ?? 0));
  else if (days !== null && days > 0) core.push(t.ahead(days));

  // Optional facts, most important first; the trimmer drops them from the end when the script runs long.
  const extras = [];
  const next = text(lead.next_step);
  if (next) extras.push(t.next(shorten(next, 10)));
  const flight = text(lead.flight_risk);
  if (flight && !EMPTY.test(flight) && flight.toLowerCase() !== "low") extras.push(t.flight(flight));
  const funding = text(lead.funding_status);
  if (funding && !EMPTY.test(funding) && !/^(no_funding|none_found|bootstrapped)$/i.test(funding)) extras.push(t.funding(funding.replace(/_/g, " ")));
  const age = text(lead.age_warning);
  if (age && !EMPTY.test(age)) extras.push(t.age(shorten(age, 10)));

  return { lead_key: lead.lead_key || lead.id, name: text(lead.name), verdict: lead.verdict, core, extras };
}

/** Funnel totals from /api/funnel's stages (traces read → leads → survivors → call now). */
export function funnelTotals(funnel) {
  const stages = Array.isArray(funnel?.stages) ? funnel.stages : [];
  const count = (key) => num(stages.find((s) => s.key === key)?.count);
  return { traces: count("traces_in"), leads: count("leads"), survivors: count("survivors"), call_now: count("call_now") };
}

/**
 * Builds the briefing text. Returns { script, segments: [{ lead_key?, text }], words, est_seconds, leads }.
 * Segments are the subtitles, in speaking order.
 */
export function buildBriefing({ leads, funnel, lang = "en", maxWords = MAX_WORDS }) {
  const t = T[lang] || T.en;
  const top = pickTop(leads);
  const totals = funnelTotals(funnel);
  const hasFunnel = Object.values(totals).some((v) => v !== null);

  const opening = `${hasFunnel ? t.opening(totals) : t.noFunnel} ${t.top(top.length)}`;
  const render = (parts) => [
    { text: opening },
    ...parts.map((p) => ({ lead_key: p.lead_key, text: [...p.core, ...p.extras].join(" ") })),
    { text: t.closing },
  ];
  const total = (segs) => words(segs.map((s) => s.text).join(" "));

  // Over budget: first drop optional facts (last lead first), then shorten the "what" lines.
  let segments;
  for (const whatWords of [12, 9, 6]) {
    const parts = top.map((lead, i) => leadSegment(lead, i, t, whatWords));
    segments = render(parts);
    while (total(segments) > maxWords && parts.some((p) => p.extras.length)) {
      [...parts].reverse().find((x) => x.extras.length).extras.pop();
      segments = render(parts);
    }
    if (total(segments) <= maxWords) break;
  }

  const script = segments.map((s) => s.text).join(" ");
  const n = words(script);
  return {
    script,
    segments,
    words: n,
    est_seconds: Math.round(n / WORDS_PER_SECOND),
    funnel: totals,
    leads: top.map((l) => ({
      lead_key: l.lead_key || l.id,
      name: l.name,
      verdict: l.verdict,
      priority: num(l.priority),
      fit_score: num(l.fit_score),
      team_score_known: num(l.team_score_known),
      days_ahead: num(l.days_ahead),
      still_invisible: truthy(l.still_invisible),
    })),
  };
}

/** Cache key for the rendered audio: same text, voice and model = same mp3. */
export function scriptHash(script, { lang, voiceId = "", model = "" } = {}) {
  return createHash("sha256").update(`${lang}|${voiceId}|${model}|${script}`).digest("hex").slice(0, 16);
}
