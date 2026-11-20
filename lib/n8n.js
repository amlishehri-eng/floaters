import automationMock from "@/data/automation.json";
import leadsSnapshot from "@/data/leads.live-snapshot.json";
import funnelSample from "@/data/funnel.sample.json";
import labsSample from "@/data/labs.sample.json";
import backtestSample from "@/data/backtest.sample.json";
import { mocksEnabled, mockFallback } from "@/lib/mocks";
import { FIT_V3 } from "@/lib/screen/criteria";

// Demo rule: fall back to the mock after ~8 s instead of leaving the screen waiting.
const TIMEOUT_MS = 8_000;
// n8n workflow "20 Leads for the screen" (read only). Works only while that workflow is published.
const LEADS_URL_DEFAULT = "https://floaters.app.n8n.cloud/webhook/htgf-leads";
// n8n workflow "44 Funnel stats" (published) and "46 Screen extras" (Labs top 10 + latest backtest, published).
const FUNNEL_URL_DEFAULT = "https://floaters.app.n8n.cloud/webhook/htgf-funnel";
const EXTRAS_URL_DEFAULT = "https://floaters.app.n8n.cloud/webhook/htgf-screen-extras";

/** POSTs payload to the main n8n webhook. Returns { ok: true, ...whatever n8n responds }. */
export async function trigger(payload) {
  if (mocksEnabled()) return { ...automationMock, mocked: true };

  try {
    const url = process.env.N8N_WEBHOOK_URL_MAIN;
    if (!url) throw new Error("N8N_WEBHOOK_URL_MAIN is not set");

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`n8n webhook returned ${res.status}`);

    // "Respond to Webhook" may send JSON, text, or nothing at all.
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await res.json() : {};
    return { ok: true, ...(data && typeof data === "object" && !Array.isArray(data) ? data : { data }) };
  } catch (err) {
    return mockFallback(automationMock, "n8n", err);
  }
}

// ---- Real leads for the screen ----------------------------------------------------------
// The Leads table stores lists as text ("Name (role); ..." and "[kind] quote" lines).
// This turns one row into the screen lead: every column (JSON parsed) plus the derived fields the pages read.

const day = (v) => (v ? String(v).slice(0, 10) : null);
const capitalise = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const list = (s, sep) => String(s || "").split(sep).map((x) => x.trim()).filter(Boolean);
const num = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

// Leads stores JSON as text. A broken cell must not break the whole screen, so it becomes the fallback.
function parseJson(v, fallback) {
  if (v && typeof v === "object") return v;
  try {
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

// fit_breakdown / team_breakdown ({ criterion: { points, max, known, why, evidence: [{ trace_id, url, quote }] } })
// -> one row per criterion for the profile card. Entries without points/max (e.g. `funding`, `stage1`) are notes, not criteria.
// known: false = the traces say nothing about it yet. unsupported = points given but no linked evidence (show it as unverified).
function toCriteria(text) {
  const obj = parseJson(text, {});
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
  return Object.entries(obj).filter(([, c]) => c && num(c.points) !== null && num(c.max) !== null).map(([key, c]) => {
    const evidence = (Array.isArray(c?.evidence) ? c.evidence : [])
      .filter((e) => e && (e.url || e.trace_id))
      .map((e) => ({ trace_id: e.trace_id || null, url: e.url || null, quote: e.quote || "" }));
    return {
      key,
      points: num(c?.points) ?? 0,
      max: num(c?.max),
      known: c?.known !== false,
      why: c?.why || "",
      evidence,
      unsupported: num(c.points) > 0 && evidence.length === 0,
    };
  });
}

// Scoring v3 weights (fit = tech depth, corporate pull, research or patent, capital need) live in lib/screen/criteria.js.
function toFitCriteriaV3(row) {
  const stored = toCriteria(row.fit_breakdown);
  const capital = toCriteria(JSON.stringify({ capital_need: parseJson(row.capital_need, null) }));
  const byKey = new Map([...stored, ...capital].map((c) => [c.key, c]));
  return FIT_V3.map(({ key, weight, from }) => {
    const c = from.map((k) => byKey.get(k)).find(Boolean);
    if (!c) return { key, points: 0, max: weight, known: false, why: "", evidence: [], unsupported: false };
    const share = c.known && !c.unsupported && c.max > 0 ? Math.min(1, c.points / c.max) : 0;
    return { ...c, key, points: Math.round(share * weight), max: weight };
  });
}

function parsePerson(text) {
  const m = text.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  return { name: m ? m[1] : text, role: m ? m[2] : "", links: [] };
}

// Every Leads column reaches the screen: JSON text cells ("{...}" / "[...]") are parsed, everything else stays as it is.
// The derived fields below (people, signals, fit_criteria, ...) are added on top, so a column the UI reads by name is always there.
function columns(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    const looksJson = typeof value === "string" && /^\s*[[{]/.test(value);
    out[key] = looksJson ? parseJson(value, value) : value;
  }
  return out;
}

function toScreenLead(row, traceById) {
  const traceIds = list(row.trace_ids, ",");
  const traces = traceIds.map((id) => traceById.get(id) || { trace_id: id, source: list(row.sources, ",")[0] || "", url: null, happened_at: row.first_trace_at, title: "" });
  const quotes = list(row.quotes, "\n").map((q) => q.replace(/^\[[^\]]*\]\s*/, ""));
  const signal = (t, quote) => ({
    trace_id: t.trace_id,
    kind: t.source,
    happened_at: day(t.happened_at) || day(row.first_trace_at),
    url: t.url || null,
    quote,
    timestamp: null,
  });
  // One signal per trace (the dashboard counts signals as "traces found"). The founder quotes go on
  // the first trace; the others show their title.
  const signals = traces.map((t, i) =>
    signal(t, (i === 0 && quotes.length ? quotes.slice(0, 3).join(" · ") : "") || t.title || row.what || row.name),
  );
  return {
    ...columns(row),
    id: row.lead_key,
    name: row.name || row.lead_key,
    people: list(row.people, ";").map(parsePerson),
    what: row.what || "",
    sector: capitalise(row.sector || "other"),
    city: row.city || "",
    country: row.country || "DE",
    stage: row.stage || "unknown",
    label: row.label || "",
    label_reason: row.label_reason || "",
    fit_score: Number(row.fit_score) || 0,
    team_score: Number(row.team_score) || 0,
    fit_reason: row.fit_reason || row.score_reason || "",
    team_reason: row.team_reason || "",
    signals,
    source_count: Number(row.source_count) || 1,
    first_trace_at: day(row.first_trace_at) || day(traces[0]?.happened_at),
    first_public_at: day(row.first_public_at),
    days_ahead: row.days_ahead ?? null,
    first_public_url: row.first_public_url || null,
    still_invisible: row.still_invisible ?? null,
    website: row.website && row.website !== "none" ? row.website : null,
    // Screening's verdict (Nils, flows 10-19): one "worth a call" for the whole team = verdict call_now = tier A.
    verdict: row.verdict || null,
    verdict_reason: row.verdict_reason || "",
    tier: row.tier || null,
    worth_a_call: row.worth_a_call === true || row.worth_a_call === "true",
    priority: num(row.priority),
    next_step: row.next_step || "",
    team_score_known: num(row.team_score_known),
    fit_criteria: Number(row.fit_version) === 3 ? toFitCriteriaV3(row) : toCriteria(row.fit_breakdown),
    team_criteria: toCriteria(row.team_breakdown),
    timing_criteria: toCriteria(row.timing_breakdown),
    eligibility: parseJson(row.eligibility, null),
    match_reasons: parseJson(row.match_reasons, []),
  };
}

// Call-now leads first, then screening's priority, then fit + team.
function byPriority(a, b) {
  return (
    Number(b.worth_a_call) - Number(a.worth_a_call) ||
    (b.priority ?? -1) - (a.priority ?? -1) ||
    b.fit_score + b.team_score - (a.fit_score + a.team_score)
  );
}

// The Leads payload (flow 20 shape: { as_of, leads, traces }) -> screen leads, call-now first.
export function toScreenLeads(data) {
  const traceById = new Map((data.traces || []).map((t) => [t.trace_id, t]));
  return (data.leads || [])
    .filter((r) => r.lead_key && r.label && r.label !== "unreadable")
    .filter((r) => !String(r.verdict || "").startsWith("merged_into:")) // folded into another lead by flow 16
    .map((r) => toScreenLead(r, traceById))
    .sort(byPriority);
}

// Fallback: a dated snapshot of the real Leads table (data/leads.live-snapshot.json), not demo leads.
function leadsFromSnapshot(err) {
  if (err) console.error("[n8n leads] falling back to the Leads snapshot:", err);
  return {
    mocked: true,
    snapshot: true,
    as_of: leadsSnapshot.as_of,
    leads: toScreenLeads(leadsSnapshot),
    ...(err && { error: String(err.message || err) }),
  };
}

/** Every lead from the n8n Leads table, every column passed through. Falls back to the Leads snapshot. */
export async function getLeads() {
  if (mocksEnabled()) return leadsFromSnapshot(null);

  try {
    const url = process.env.N8N_LEADS_URL || LEADS_URL_DEFAULT;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(res.status === 404 ? 'flow 20 "Leads for the screen" is not published' : `flow 20 answered ${res.status}`);
    const data = await res.json();
    return { mocked: false, as_of: data.as_of || new Date().toISOString(), leads: toScreenLeads(data) };
  } catch (err) {
    return leadsFromSnapshot(err);
  }
}

async function getJson(url, what) {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${what} returned ${res.status}`);
  return res.json();
}

/** Funnel counts and costs from flow "44 Funnel stats". Falls back to data/funnel.sample.json (a dated snapshot). */
export async function getFunnel() {
  if (mocksEnabled()) return { ...funnelSample, mocked: true };
  try {
    const data = await getJson(process.env.N8N_FUNNEL_URL || FUNNEL_URL_DEFAULT, "n8n funnel webhook");
    if (!data || typeof data !== "object" || !Array.isArray(data.stages)) throw new Error("n8n funnel webhook returned no stages");
    return { ...data, mocked: false };
  } catch (err) {
    console.warn("[funnel] n8n unreachable, serving the snapshot:", err.message);
    return { ...funnelSample, mocked: true, n8n_error: err.message, error: `flow 44: ${err.message}` };
  }
}

/** Labs top 10 and the latest blind backtest from flow "46 Screen extras". Falls back to data/labs.sample.json + data/backtest.sample.json. */
export async function getExtras() {
  const sample = { as_of: labsSample.as_of, labs: labsSample.labs, backtest: backtestSample.backtest };
  if (mocksEnabled()) return { ...sample, mocked: true };
  try {
    const data = await getJson(process.env.N8N_EXTRAS_URL || EXTRAS_URL_DEFAULT, "n8n screen extras webhook");
    if (!Array.isArray(data?.labs)) throw new Error("n8n screen extras webhook returned no labs");
    return { as_of: data.as_of, labs: data.labs, backtest: data.backtest || null, mocked: false };
  } catch (err) {
    console.warn("[extras] n8n unreachable, serving the snapshots:", err.message);
    return { ...sample, mocked: true, error: `flow 46: ${err.message}` };
  }
}
