import automationMock from "@/data/automation.json";
import leadsSnapshot from "@/data/leads.live-snapshot.json";
import funnelSample from "@/data/funnel.sample.json";
import labsSample from "@/data/labs.sample.json";
import backtestSample from "@/data/backtest.sample.json";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { unstable_cache } from "next/cache";
import { mocksEnabled, mockFallback } from "@/lib/mocks";
import { FIT_V3 } from "@/lib/screen/criteria";
import { applyTranslations, ensureEnglish } from "@/lib/ai/translate";

// Demo rule: fall back to the mock after ~8 s instead of leaving the screen waiting.
const TIMEOUT_MS = 8_000;
// n8n workflow "20 Leads for the screen" (read only). Works only while that workflow is published.
const LEADS_URL_DEFAULT = "https://floaters.app.n8n.cloud/webhook/htgf-leads";
// n8n workflow "44 Funnel stats" (published) and "46 Screen extras" (Labs top 10 + latest backtest, published).
const FUNNEL_URL_DEFAULT = "https://floaters.app.n8n.cloud/webhook/htgf-funnel";
const EXTRAS_URL_DEFAULT = "https://floaters.app.n8n.cloud/webhook/htgf-screen-extras";
// n8n workflow "42 Feedback": POST saves a vote (app/api/feedback), GET on the same path lists every vote.
const FEEDBACK_URL_DEFAULT = "https://floaters.app.n8n.cloud/webhook/htgf-feedback";
export const CANDIDATES_TAG = "candidates";

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
// English everywhere: the cached translations (lib/ai/translate.js, data/translations.json) are laid over each raw row
// before it becomes a screen lead.
export function toScreenLeads(data) {
  const traceById = new Map((data.traces || []).map((t) => [t.trace_id, t]));
  return (data.leads || [])
    .filter((r) => r.lead_key && r.label && r.label !== "unreadable")
    .filter((r) => !String(r.verdict || "").startsWith("merged_into:")) // folded into another lead by flow 16
    .map((r) => toScreenLead(applyTranslations(r), traceById))
    .sort(byPriority);
}

// The raw rows stay on the result (not enumerable, so /api/leads is unchanged) for render-time translation.
function withRaw(result, data) {
  Object.defineProperty(result, "raw", { value: new Map((data.leads || []).map((r) => [r.lead_key, r])), enumerable: false });
  Object.defineProperty(result, "traceById", { value: new Map((data.traces || []).map((t) => [t.trace_id, t])), enumerable: false });
  return result;
}

/** One lead, in English: anything the cache does not hold yet is translated now (8 s at most, else the original). */
export async function getLeadEnglish(key) {
  const data = await getLeads();
  const raw = data.raw?.get(key);
  if (!raw) return data.leads.find((l) => l.id === key) || null;
  await ensureEnglish([raw]);
  return toScreenLead(applyTranslations(raw), data.traceById);
}

// Fallback: a dated snapshot of the real Leads table (data/leads.live-snapshot.json), not demo leads.
function leadsFromSnapshot(err) {
  if (err) console.error("[n8n leads] falling back to the Leads snapshot:", err);
  return withRaw({
    mocked: true,
    snapshot: true,
    as_of: leadsSnapshot.as_of,
    leads: toScreenLeads(leadsSnapshot),
    ...(err && { error: String(err.message || err) }),
  }, leadsSnapshot);
}

// ---- Short server-side cache ----------------------------------------------------------------
// Clicking between pages should not refetch n8n every time. Next's fetch cache (`next: { revalidate }`) refuses
// entries over 2 MB (node_modules/next/dist/server/lib/incremental-cache/index.js), and the Leads payload (whole table
// plus traces) is far bigger, so this is a plain in-process cache: 60 s for live data, 15 s for a fallback (so a dead
// n8n is retried soon but does not cost every click 8 s). One request at a time per key; the key includes the URL and
// USE_MOCKS, so changing either never serves the other's data.
export const CACHE_MS = 60_000;
const FALLBACK_CACHE_MS = 15_000;
const memo = new Map();

async function cached(key, load) {
  const hit = memo.get(key);
  if (hit?.value && Date.now() - hit.at < hit.ttl) return hit.value;
  if (hit?.pending) return hit.pending;
  const pending = load()
    .then((value) => {
      memo.set(key, { at: Date.now(), ttl: value.mocked ? FALLBACK_CACHE_MS : CACHE_MS, value });
      return value;
    })
    .catch((err) => {
      memo.delete(key);
      throw err;
    });
  memo.set(key, { ...hit, pending });
  return pending;
}

/** Leads straight from flow 20, uncached. Returns the parsed payload plus how long it took and how big it was. */
export async function fetchLeadsPayload(url = process.env.N8N_LEADS_URL || LEADS_URL_DEFAULT) {
  const started = Date.now();
  // The timeout covers the body too, so a slow, large answer still gives up after 8 s.
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(res.status === 404 ? 'flow 20 "Leads for the screen" is not published' : `flow 20 answered ${res.status}`);
  const text = await res.text();
  const data = JSON.parse(text);
  if (!Array.isArray(data?.leads)) throw new Error("flow 20 answered without a leads list");
  return { data, bytes: Buffer.byteLength(text), ms: Date.now() - started };
}

/** Every lead from the n8n Leads table, every column passed through. Cached 60 s; falls back to the Leads snapshot. */
export async function getLeads() {
  if (mocksEnabled()) return leadsFromSnapshot(null);
  const url = process.env.N8N_LEADS_URL || LEADS_URL_DEFAULT;
  return cached(`leads|${url}`, async () => {
    try {
      const { data, bytes, ms } = await fetchLeadsPayload(url);
      // The call list shows the call-now leads in detail: make sure they are English before they reach the page.
      await ensureEnglish(data.leads.filter((r) => r.verdict === "call_now"));
      return withRaw({ mocked: false, as_of: data.as_of || new Date().toISOString(), leads: toScreenLeads(data), fetch: { bytes, ms } }, data);
    } catch (err) {
      return leadsFromSnapshot(err);
    }
  });
}

async function getJson(url, what) {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${what} returned ${res.status}`);
  return res.json();
}

/** Funnel counts and costs from flow "44 Funnel stats", cached 60 s. Falls back to data/funnel.sample.json (a dated snapshot). */
export async function getFunnel() {
  if (mocksEnabled()) return { ...funnelSample, mocked: true };
  const url = process.env.N8N_FUNNEL_URL || FUNNEL_URL_DEFAULT;
  return cached(`funnel|${url}`, () => loadFunnel(url));
}

async function loadFunnel(url) {
  try {
    const data = await getJson(url, "n8n funnel webhook");
    if (!data || typeof data !== "object" || !Array.isArray(data.stages)) throw new Error("n8n funnel webhook returned no stages");
    return { ...data, mocked: false };
  } catch (err) {
    console.warn("[funnel] n8n unreachable, serving the snapshot:", err.message);
    return { ...funnelSample, mocked: true, n8n_error: err.message, error: `flow 44: ${err.message}` };
  }
}

/** Labs top 10 and the latest blind backtest from flow "46 Screen extras", cached 60 s. Falls back to data/labs.sample.json + data/backtest.sample.json. */
export async function getExtras() {
  const sample = { as_of: labsSample.as_of, labs: labsSample.labs, backtest: backtestSample.backtest };
  if (mocksEnabled()) return { ...sample, mocked: true };
  const url = process.env.N8N_EXTRAS_URL || EXTRAS_URL_DEFAULT;
  return cached(`extras|${url}`, () => loadExtras(url, sample));
}

async function loadExtras(url, sample) {
  try {
    const data = await getJson(url, "n8n screen extras webhook");
    if (!Array.isArray(data?.labs)) throw new Error("n8n screen extras webhook returned no labs");
    return { as_of: data.as_of, labs: data.labs, backtest: data.backtest || null, mocked: false };
  } catch (err) {
    console.warn("[extras] n8n unreachable, serving the snapshots:", err.message);
    return { ...sample, mocked: true, error: `flow 46: ${err.message}` };
  }
}

// ---- Candidates: leads marked "Good lead" on the call list --------------------------------------
// Votes come from flow 42's GET (Next's cache, tag "candidates", 60 s; /api/feedback clears the tag after each vote).
// If n8n does not answer (or USE_MOCKS=true), the votes kept locally in data/feedback.local.json are used instead.

async function fetchVotes(url) {
  const data = await getJson(url, "n8n feedback webhook");
  if (!Array.isArray(data?.votes)) throw new Error("n8n feedback webhook returned no votes");
  return { as_of: data.as_of || new Date().toISOString(), votes: data.votes };
}

// unstable_cache needs the Next server; plain node (scripts/test-screen.mjs) fetches directly.
const votesCached = (url) =>
  process.env.NEXT_RUNTIME
    ? unstable_cache(() => fetchVotes(url), ["feedback-votes", url], { revalidate: 60, tags: [CANDIDATES_TAG] })()
    : fetchVotes(url);

async function localVotes() {
  try {
    const votes = JSON.parse(await readFile(path.join(process.cwd(), "data", "feedback.local.json"), "utf8"));
    return Array.isArray(votes) ? votes : [];
  } catch {
    return [];
  }
}

/** Every vote: { mocked, as_of, votes: [{ lead_key, vote, reason, created_at }], error? }. */
export async function getVotes() {
  if (mocksEnabled()) return { mocked: true, as_of: null, votes: await localVotes() };
  const url = process.env.N8N_FEEDBACK_URL || FEEDBACK_URL_DEFAULT;
  try {
    const { as_of, votes } = await votesCached(url);
    return { mocked: false, as_of, votes };
  } catch (err) {
    console.warn("[candidates] n8n feedback unreachable, using the local votes:", err.message);
    return { mocked: true, as_of: null, votes: await localVotes(), error: `flow 42: ${err.message}` };
  }
}

/** The latest vote per lead_key (a later "down" replaces an earlier "up"). */
export function latestVotes(votes) {
  const latest = new Map();
  for (const v of votes || []) {
    if (!v?.lead_key || (v.vote !== "up" && v.vote !== "down")) continue;
    const prev = latest.get(v.lead_key);
    if (!prev || String(v.created_at || "") >= String(prev.created_at || "")) latest.set(v.lead_key, v);
  }
  return latest;
}

/** Leads whose latest vote is "up", joined with the leads (keys that no longer exist are skipped), newest vote first. */
export async function getCandidates() {
  const [leadsData, votesData] = await Promise.all([getLeads(), getVotes()]);
  const byKey = new Map(leadsData.leads.map((l) => [l.id, l]));
  const candidates = [...latestVotes(votesData.votes).values()]
    .filter((v) => v.vote === "up" && byKey.has(v.lead_key))
    .map((v) => ({ lead: byKey.get(v.lead_key), voted_at: v.created_at || null, reason: v.reason || "" }))
    // Best fit first; ties go to the newest vote.
    .sort((a, b) => (Number(b.lead.fit_score) || 0) - (Number(a.lead.fit_score) || 0) || String(b.voted_at || "").localeCompare(String(a.voted_at || "")));
  return { leads: leadsData, votes: votesData, candidates };
}
