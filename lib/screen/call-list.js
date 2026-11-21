// Call list (/proof/live): turns screen leads from lib/n8n.js getLeads() into what design/reference/call-list.dc.html shows.
// Pure functions: every empty value gets its honest empty state (DESIGN.md section 7), never null or undefined.
import { CHECKS, FUNDING, TEAM, TIMING, label } from "./criteria";
import { capitalise, clip, dayMonth, decodeEntities, host, int, isNum, longDate, sourceHint, words } from "./format";

export const TONE = { low: "#1b7a4b", medium: "#9a5b00", high: "#b8321a", info: "#0a6e99", none: "#6e6e73" };
const CHECK_TONE = {
  pass: { ink: "#1b7a4b", dot: "#2fbf71", text: "Pass" },
  fail: { ink: "#b8321a", dot: "#ff5b3a", text: "Fail" },
  unknown: { ink: "#6e6e73", dot: "#b8bcc6", text: "Unknown" },
};
const RISK_TONE = { low: "low", medium: "medium", high: "high" };

const truthy = (v) => v === true || v === "true";
const arr = (v) => (Array.isArray(v) ? v : []);
const text = (v) => (typeof v === "string" ? v.trim() : "");
const sentence = (s) => (s && !/[.!?…]$/.test(s) ? `${s}.` : s);

export function place(lead) {
  const stage = text(lead.stage) && lead.stage !== "unknown" ? lead.stage : "stage not known";
  return [lead.city || "City not known", text(lead.sector).toLowerCase() || "sector not known", stage].join(", ");
}

/** "Days ahead" badge, tone and the sentence under "Why now". */
export function daysAhead(lead) {
  const d = isNum(lead.days_ahead) ? Number(lead.days_ahead) : null;
  const firstTrace = longDate(lead.first_trace_at);
  const press = longDate(lead.first_public_at);
  const pressUrl = text(lead.first_public_url) || "";
  if (truthy(lead.still_invisible)) {
    return d !== null && d >= 0
      ? { badge: `Still invisible, ${int(d)} ${d === 1 ? "day" : "days"} ahead`, tone: "low", text: `No press and no funding news found so far.${firstTrace ? ` Our first trace is from ${firstTrace}.` : ""}`, pressUrl: "" }
      : { badge: "No press found yet", tone: "low", text: "No editorial coverage found so far.", pressUrl: "" };
  }
  if (pressUrl || press) {
    if (d !== null && d < 0) {
      const n = -d;
      return {
        badge: n === 1 ? "Seen one day after the first press" : `Press ${int(n)} days before us`,
        tone: n > 365 ? "high" : "medium",
        text: `The first mention we found is from ${press || "before our first trace"}${firstTrace ? `, our first trace from ${firstTrace}` : ""}.`,
        pressUrl,
      };
    }
    if (d !== null) {
      return {
        badge: d === 0 ? "Seen the same day as the first press" : `${int(d)} ${d === 1 ? "day" : "days"} before the first press`,
        tone: "low",
        text: `We found them ${firstTrace ? `on ${firstTrace}, ` : ""}${int(d)} ${d === 1 ? "day" : "days"} before the first mention${press ? ` on ${press}` : ""}.`,
        pressUrl,
      };
    }
    return { badge: "Press found", tone: "info", text: "A public mention exists; its date is not known yet.", pressUrl };
  }
  if (lead.news_checked_at) return { badge: "No press found yet", tone: "low", text: "No editorial coverage found so far.", pressUrl: "" };
  return { badge: "Press not checked yet", tone: "none", text: "Not checked yet. The press check runs with the next pipeline run.", pressUrl: "" };
}

export function funding(lead) {
  const status = text(lead.funding_status) || "unknown";
  const evidence = text(lead.funding_evidence);
  return {
    badge: FUNDING[status] || capitalise(status.replace(/_/g, " ")),
    status: FUNDING[status] || capitalise(status.replace(/_/g, " ")),
    evidence: evidence ? `“${evidence.replace(/^["“]|["”]$/g, "")}”` : "No investor or grant mention in the traces.",
    coInvestors: text(lead.co_investors) || "none named",
  };
}

function people(lead) {
  const list = arr(lead.people).filter((p) => p && p.name);
  if (!list.length) return "No founders named yet.";
  return list.map((p) => (p.role ? `${p.name}, ${String(p.role).replace(/_/g, " ")}.` : `${p.name}.`)).join(" ");
}

// Why a criterion got its points, for the dropdown under each fit and team bar. Only the "Source: <host>" lines link out.
function panel(c, known, points, m) {
  const ev = arr(c?.evidence).filter((e) => e && (e.quote || e.url));
  const quotes = [...new Set(ev.map((e) => clip(text(e.quote), 220)).filter((q) => q.length >= 12))].slice(0, 2);
  const seen = new Set();
  const sources = ev
    .filter((e) => /^https?:\/\//.test(text(e.url)) && !seen.has(e.url) && seen.add(e.url))
    .slice(0, 3)
    .map((e) => ({ url: e.url, host: host(e.url).split("/")[0] }));
  let why;
  if (!known) why = "The sources say nothing about this yet, so it scores no points.";
  else if (c?.unsupported) why = `${clip(text(c.why), 220) || "A reason was given"}. No source backs it, so it counts no points.`;
  else why = clip(text(c?.why), 260) || `${points} of ${m} points; the model gave no reason.`;
  return { why: sentence(why.replace(/\.\.$/, ".")), quotes: known ? quotes : [], sources: known ? sources : [] };
}

function bar(c, max) {
  const known = c && c.known !== false;
  const points = isNum(c?.points) ? Number(c.points) : 0;
  const m = isNum(c?.max) && Number(c.max) > 0 ? Number(c.max) : max;
  return {
    key: c?.key,
    label: label(c?.key),
    pct: known ? Math.max(0, Math.min(100, Math.round((points / m) * 100))) : 0,
    shown: !known ? "not known" : c.unsupported ? `${points} of ${m}, no source` : `${points} of ${m}`,
    ink: known && !c.unsupported ? "#4a4a4f" : "#6e6e73",
    pts: known ? points : null,
    max: m,
    panel: panel(c, known, points, m),
  };
}

function ordered(criteria, order) {
  const byKey = new Map(arr(criteria).map((c) => [c.key, c]));
  const listed = order.map((o) => byKey.get(o.key) || { key: o.key, points: 0, max: o.weight, known: false, evidence: [] });
  const extra = arr(criteria).filter((c) => !order.some((o) => o.key === c.key));
  return [...listed, ...extra];
}

function checks(lead) {
  const el = lead.eligibility && typeof lead.eligibility === "object" ? lead.eligibility : {};
  return CHECKS.map(({ key, label: name }) => {
    const c = el[key] || {};
    const tone = CHECK_TONE[c.result] || CHECK_TONE.unknown;
    let evidence = clip(text(c.evidence) || "not checked yet", 160);
    const age = lead.age_check && typeof lead.age_check === "object" ? lead.age_check : null;
    const reg = age?.register && typeof age.register === "object" ? age.register : null;
    if (key === "stage" && age?.founded_year) {
      evidence = clip(`Founded ${age.founded_year}${age.founded_url ? ` (${host(age.founded_url).split("/")[0]})` : ""}${text(c.evidence) ? `; ${text(c.evidence)}` : ""}`, 160);
    }
    if (key === "legal_entity" && reg?.number && !lead.registry_checked_at) {
      evidence = clip(`${[reg.court, reg.number].filter(Boolean).join(", ")}${reg.registered_date ? `, registered ${longDate(reg.registered_date)}` : ""}`, 160);
    }
    if (key === "legal_entity" && lead.registry_checked_at) {
      const entry = truthy(lead.registered)
        ? [lead.legal_form, lead.register_id, lead.registered_at && `registered ${longDate(lead.registered_at)}`].filter(Boolean).join(", ")
        : "not in the register yet";
      const signals = arr(lead.registry_signals).length ? `; ${arr(lead.registry_signals).slice(0, 2).join("; ")}` : "";
      evidence = clip(`Register: ${entry}${signals}`, 160);
    }
    return { key, label: name, result: tone.text, ink: tone.ink, dot: tone.dot, evidence };
  });
}

const claim = (v) => clip(arr(v).map((x) => x?.claim).find(Boolean) || "", 120);

function deep(lead) {
  if (!lead.deep_checked_at) return { checked: false, when: "Not run yet", items: [] };
  const risk = (v) => RISK_TONE[text(v).toLowerCase()] || "none";
  const level = (v) => (text(v) ? capitalise(text(v).toLowerCase()) : "Not known");
  const ip = text(lead.ip_status);
  const competitors = arr(lead.competitors).map((c) => c?.name).filter(Boolean);
  const bridge = arr(lead.grant_bridges)[0];
  const intro = text(lead.intro_path);
  const age = isNum(lead.domain_age_days) ? Number(lead.domain_age_days) : null;
  const bus = lead.bus_factor ?? lead.commitment;
  const items = [
    { label: "Flight risk", value: level(lead.flight_risk), tone: risk(lead.flight_risk), note: claim(lead.flight_risk_evidence) || "No evidence either way." },
    { label: "IP", value: ip ? capitalise(ip.replace(/_/g, " ")) : "Not known", tone: "none", note: claim(lead.ip_evidence) || "No patent found in quick searches." },
    { label: "Competitors", value: level(lead.crowdedness), tone: risk(lead.crowdedness), note: competitors.length ? `${competitors.slice(0, 3).join(", ")}${competitors.length > 3 ? " and others" : ""}` : "none named" },
    { label: "Series A risk", value: level(lead.series_a_risk), tone: risk(lead.series_a_risk), note: clip(text(lead.series_a_notes), 120) || "Checked for the top ten only." },
    { label: "Grant bridge", value: bridge?.programme || "None yet", tone: bridge ? "info" : "none", note: clip(bridge?.why_it_fits || "", 120) || "No programme found." },
    { label: "Intro path", value: intro ? "Found" : "None yet", tone: intro ? "info" : "none", note: intro ? clip(intro, 120) : "No HTGF portfolio link found." },
    { label: "Bus factor", value: bus !== null && bus !== undefined && bus !== "" ? clip(typeof bus === "object" ? JSON.stringify(bus) : String(bus), 24) : "n/a", tone: "none", note: bus ? clip(text(lead.commitment) || "", 120) || "From public GitHub activity." : "No public GitHub." },
    { label: "Domain age", value: age === null ? "n/a" : age >= 730 ? `${Math.floor(age / 365)} years` : `${int(age)} days`, tone: age === null ? "none" : "info", note: age === null ? "Not read." : "From the domain registration and its first certificate." },
  ].map((d) => ({ ...d, ink: TONE[d.tone] }));
  return { checked: true, when: `Checked ${dayMonth(lead.deep_checked_at)}`, items };
}

// Two founder quotes; one-word facts ("Founded: 2024") are not quotes.
function quotes(lead) {
  return decodeEntities(lead.quotes).split("\n").map((q) => q.replace(/^\[[^\]]*\]\s*/, "").trim()).filter((q) => q.length >= 30).slice(0, 2);
}

function evidenceUrls(lead) {
  const urls = new Map();
  for (const c of [...arr(lead.fit_criteria), ...arr(lead.team_criteria), ...arr(lead.timing_criteria)]) {
    for (const e of arr(c.evidence)) if (e?.trace_id && e.url && !urls.has(e.trace_id)) urls.set(e.trace_id, e.url);
  }
  for (const s of arr(lead.signals)) if (s?.trace_id && s.url && !urls.has(s.trace_id)) urls.set(s.trace_id, s.url);
  return urls;
}

function sources(lead) {
  const urls = evidenceUrls(lead);
  const reasons = arr(lead.match_reasons).filter((m) => m && m.trace_id);
  const ids = reasons.length ? reasons : String(lead.trace_ids || "").split(",").map((id) => ({ trace_id: id.trim(), how: "trace of this lead" })).filter((m) => m.trace_id);
  const s = isNum(lead.source_count) ? Number(lead.source_count) : 1;
  const t = isNum(lead.trace_count) ? Number(lead.trace_count) : ids.length || 1;
  return {
    line: `${words(s, true)} ${s === 1 ? "source" : "sources"}, ${words(t)} ${t === 1 ? "trace" : "traces"}${lead.first_trace_at ? `, first seen ${longDate(lead.first_trace_at)}` : ""}`,
    quotes: quotes(lead),
    matches: ids.map((m) => ({ id: m.trace_id, how: m.how || "trace of this lead", url: urls.get(m.trace_id) || "" })),
    type: text(lead.type_reason)
      ? `${lead.lead_type === "startup_candidate" || !lead.lead_type ? "Why it counts as a startup" : `Read as ${String(lead.lead_type).replace(/_/g, " ")}`}: ${text(lead.type_reason)}`
      : "",
  };
}

function antiSignals(lead) {
  return arr(lead.anti_signals).filter((a) => a && a.signal).map((a) => `${a.signal.replace(/_/g, " ")} (${a.points})`);
}

function outsideProof(lead) {
  const m = text(lead.verdict_reason).match(/validated by (.+?)(?:, technical founder|\s*\(|$)/);
  return m ? `Outside proof: ${m[1].replace(/, ([^,]+)$/, " and $1")}.` : "";
}

const scoreOrNull = (v) => (isNum(v) ? Math.round(Number(v)) : null);

function ring(name, value, sub, color) {
  return {
    label: name,
    value: value === null ? "–" : String(value),
    sub,
    color,
    deg: value === null ? 0 : Math.round(Math.max(0, Math.min(100, value)) * 3.6),
    aria: value === null ? `${name} not known` : `${name} ${value} of 100`,
  };
}

/** The selected lead's detail sheet. */
export function leadDetail(lead) {
  const days = daysAhead(lead);
  const fund = funding(lead);
  const fitRows = arr(lead.fit_criteria).filter((c) => c.key !== "germany").map((c) => bar(c, 10));
  const teamCrit = ordered(lead.team_criteria, TEAM);
  const teamRows = teamCrit.map((c) => bar(c, 10));
  const knownCount = teamCrit.slice(0, 8).filter((c) => c.known !== false && arr(lead.team_criteria).some((t) => t.key === c.key)).length;
  const timingRows = ordered(lead.timing_criteria, TIMING).slice(0, 4).map((c) => bar(c, 10));
  const team = scoreOrNull(lead.team_score_known);
  const website = text(lead.website);
  return {
    key: lead.id,
    name: lead.name || lead.id,
    place: place(lead),
    what: text(lead.what) || "No description in the traces yet.",
    people: people(lead),
    website,
    websiteLabel: host(website),
    rings: [
      ring("Fit", scoreOrNull(lead.fit_score), "HTGF fit", "#1d1d1f"),
      ring("Team", team, `${knownCount} of 8 known`, "#0a6e99"),
      ring("Timing", scoreOrNull(lead.timing_score), "when to call", "#ff5b3a"),
    ],
    callNow: lead.verdict === "call_now",
    reason: [sentence(text(lead.fit_reason) || text(lead.verdict_reason) || "No reason recorded yet."), outsideProof(lead)].filter(Boolean).join(" "),
    next: text(lead.next_step) ? sentence(text(lead.next_step)) : "not set yet. It comes with the next deep-check run.",
    ageWarning: text(lead.age_warning),
    days,
    daysInk: TONE[days.tone],
    timingRows,
    checks: checks(lead),
    funding: fund,
    fitRows,
    teamRows,
    teamReason: text(lead.team_reason),
    antiSignals: antiSignals(lead),
    deep: deep(lead),
    sources: sources(lead),
  };
}

/** One row of the list on the left. */
export function leadRow(lead) {
  const days = daysAhead(lead);
  const fit = scoreOrNull(lead.fit_score);
  const team = scoreOrNull(lead.team_score_known);
  const timing = scoreOrNull(lead.timing_score);
  return {
    key: lead.id,
    name: lead.name || lead.id,
    place: place(lead),
    callNow: lead.verdict === "call_now" || truthy(lead.worth_a_call),
    daysBadge: days.badge,
    daysInk: TONE[days.tone],
    fundingBadge: funding(lead).badge,
    fit: fit === null ? "not known" : String(fit),
    team: team === null ? "not known" : String(team),
    timing: timing === null ? "not known" : String(timing),
  };
}

// The fields the existing memo export (downloadMemo in app/proof/(legacy)/proof-dashboard.js) reads, so the client gets only those.
const MEMO_FIELDS = ["id", "name", "what", "city", "country", "sector", "stage", "fit_score", "fit_reason", "team_score", "team_reason",
  "website", "verdict", "verdict_reason", "next_step", "people", "signals", "first_public_at", "first_trace_at"];
export function memoLead(lead) {
  return Object.fromEntries(MEMO_FIELDS.map((k) => [k, lead[k] ?? (k === "people" || k === "signals" ? [] : "")]));
}

/** The whole page: call-now leads in priority order (getLeads already sorts), header copy and the data line. */
export function callList({ leads, asOf, funnel, mocked = false, error = "" }) {
  const callNow = arr(leads).filter((l) => l.verdict === "call_now");
  const signals = funnel?.stages?.find((s) => s.key === "traces_in")?.count ?? funnel?.traces?.total;
  const n = callNow.length;
  // The call-now count always comes from the leads on this page (never from a funnel of another moment).
  const updated = ` ${sourceHint({ mocked, error, asOf })}`;
  const intro = n
    ? `${words(n, true)} ${n === 1 ? "team" : "teams"} worth a call${isNum(signals) ? `, out of ${int(signals)} signals read across Germany` : ""}.${updated}`
    : `No team is worth a call right now.${updated} New leads appear after the next pipeline run.`;
  return { intro, rows: callNow.map(leadRow), details: callNow.map(leadDetail), memos: callNow.map(memoLead) };
}
