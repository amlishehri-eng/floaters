import automationMock from "@/data/automation.json";
import leadsMock from "@/data/proof-leads.json";
import { mocksEnabled, mockFallback } from "@/lib/mocks";

const TIMEOUT_MS = 10_000;
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
    city: row.city || "Munich",
    country: "DE",
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
  };
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
      .map((r) => toScreenLead(r, traceById))
      .sort((a, b) => b.fit_score + b.team_score - (a.fit_score + a.team_score));
    return { mocked: false, as_of: day(data.as_of) || day(new Date().toISOString()), leads };
  } catch (err) {
    return mockFallback(leadsMock, "n8n leads", err);
  }
}
