import automationMock from "@/data/automation.json";
import leadsMock from "@/data/proof-leads.json";
import { mocksEnabled, mockFallback } from "@/lib/mocks";

// Demo rule: fall back to the mock after ~8 s instead of leaving the screen waiting.
const TIMEOUT_MS = 8_000;
// n8n workflow "20 Leads for the screen" (read only). Works only while that workflow is published.
const LEADS_URL_DEFAULT = "https://floaters.app.n8n.cloud/webhook/htgf-leads";

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
// This turns one row into the shape ProofDashboard (app/proof/proof-dashboard.js) expects.

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

// Scoring v3 (n8n/scoring-v3-plan.md, flow 13 v8): fit counts only these four, each scaled to its v3 weight.
// Germany, sector, stage and no funding are hard checks (in `eligibility`), not points. Keep in sync with FIT_W in flow 13.
const FIT_V3 = [
  { key: "tech_depth", weight: 40, from: ["tech_depth"] },
  { key: "corporate_pull", weight: 25, from: ["corporate_pull"] },
  { key: "research_or_patent", weight: 20, from: ["research_or_patent", "patent_before_company"] },
  { key: "capital_need", weight: 15, from: ["capital_need"] },
];

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

/** Every lead from the n8n Leads table, ready for ProofDashboard. Falls back to the demo leads. */
export async function getLeads() {
  if (mocksEnabled()) return { ...leadsMock, mocked: true };

  try {
    const url = process.env.N8N_LEADS_URL || LEADS_URL_DEFAULT;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`n8n leads link returned ${res.status} (is "20 Leads for the screen" published?)`);
    const data = await res.json();
    const traceById = new Map((data.traces || []).map((t) => [t.trace_id, t]));
    const leads = (data.leads || [])
      .filter((r) => r.lead_key && r.label && r.label !== "unreadable")
      .filter((r) => !String(r.verdict || "").startsWith("merged_into:")) // folded into another lead by flow 16
      .map((r) => toScreenLead(r, traceById))
      .sort(byPriority);
    return { mocked: false, as_of: day(data.as_of) || day(new Date().toISOString()), leads };
  } catch (err) {
    return mockFallback(leadsMock, "n8n leads", err);
  }
}
