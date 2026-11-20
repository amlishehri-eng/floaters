// The whole brain: traces (+ last run's leads) in, leads out. Pure JSON, no table I/O.
// Pass a fake `llm` to run it offline (scripts/test-brain.mjs does).
import { costOf, structured } from "../openai.js";
import { CONCURRENCY, WORTH_A_CALL } from "./config.js";
import { buildLead, converge, mentionsFromLeads, mentionsFromTraces } from "./converge.js";
import { daysAhead, findFirstPublic, PUBLIC_SIGNAL_KIND, publicSignal } from "./days-ahead.js";
import { extractTrace } from "./extract.js";
import { labelLead } from "./filter.js";
import { parseJson, toBool, toDay, toNumber } from "./normalize.js";
import { mapLimit } from "./pool.js";
import { scoreLead } from "./score.js";

export const PRICES_CHECKED = "2026-11-20";

export function isWorthACall(lead) {
  return lead.label === "vc_backable" && lead.fit_score >= WORTH_A_CALL.fit && lead.team_score >= WORTH_A_CALL.team;
}

// Arrays/objects → JSON strings, so n8n can map a lead straight into a table row.
export function toRow(lead) {
  return Object.fromEntries(
    Object.entries(lead).map(([k, v]) => [k, v !== null && typeof v === "object" ? JSON.stringify(v) : v]),
  );
}

function round(n) {
  return Math.round(n * 1e6) / 1e6;
}

function costSummary(usages, { traceCount, leadCount, vcCount }) {
  const byStep = {};
  for (const u of usages) {
    const s = (byStep[u.step] ||= { calls: 0, input_tokens: 0, output_tokens: 0, web_search_calls: 0, usd: 0 });
    s.calls += 1;
    s.input_tokens += u.input_tokens;
    s.output_tokens += u.output_tokens;
    s.web_search_calls += u.web_search_calls || 0;
    s.usd += costOf(u);
  }
  for (const s of Object.values(byStep)) s.usd = round(s.usd);
  const total = usages.reduce((sum, u) => sum + costOf(u), 0);
  return {
    total_usd: round(total),
    per_trace_usd: round(total / Math.max(1, traceCount)),
    per_lead_usd: round(total / Math.max(1, leadCount)),
    per_vc_backable_lead_usd: round(total / Math.max(1, vcCount)),
    calls: usages.length,
    by_step: byStep,
    prices_checked: PRICES_CHECKED,
  };
}

async function extractAll(traces, ctx) {
  const updates = [];
  await mapLimit(traces, CONCURRENCY, async (trace) => {
    if (Array.isArray(trace.extraction?.projects)) {
      // Already extracted in an earlier run: reuse, never extract a trace twice.
      if (trace.status !== "processed") {
        updates.push({ id: trace.id, status: "processed", extraction: JSON.stringify(trace.extraction) });
      }
      return;
    }
    try {
      const { extraction, usage } = await extractTrace(trace, ctx.llm);
      ctx.track(usage, { step: "extract", trace_id: trace.id });
      trace.extraction = extraction;
      updates.push({ id: trace.id, status: "processed", extraction: JSON.stringify(extraction) });
    } catch (err) {
      if (err.usage) ctx.track(err.usage, { step: "extract", trace_id: trace.id });
      ctx.onError({ step: "extract", trace_id: trace.id }, err); // trace stays "new" and is retried next run
    }
  });
  return updates;
}

// Steps 2, 4 and 5 for one lead, reusing last run's answers where the evidence hasn't changed.
async function judgeLead({ lead, evidence }, prev, ctx) {
  const sameEvidence = Boolean(prev && prev.evidence_hash === lead.evidence_hash);

  if (sameEvidence && prev.label) {
    lead.label = prev.label;
    lead.label_reason = prev.label_reason || null;
  } else {
    try {
      const r = await labelLead(lead, evidence, ctx.llm);
      ctx.track(r.usage, { step: "filter", lead_id: lead.id });
      lead.label = r.label;
      lead.label_reason = r.label_reason;
    } catch (err) {
      if (err.usage) ctx.track(err.usage, { step: "filter", lead_id: lead.id });
      ctx.onError({ step: "filter", lead_id: lead.id }, err);
      return lead;
    }
  }
  if (lead.label !== "vc_backable") return lead;

  if (sameEvidence && toNumber(prev.fit_score) != null && toNumber(prev.team_score) != null) {
    lead.fit_score = toNumber(prev.fit_score);
    lead.team_score = toNumber(prev.team_score);
    lead.fit_reason = prev.fit_reason || null;
    lead.team_reason = prev.team_reason || null;
  } else {
    try {
      const r = await scoreLead(lead, evidence, ctx.llm);
      ctx.track(r.usage, { step: "score", lead_id: lead.id });
      Object.assign(lead, { fit_score: r.fit_score, team_score: r.team_score, fit_reason: r.fit_reason, team_reason: r.team_reason });
    } catch (err) {
      if (err.usage) ctx.track(err.usage, { step: "score", lead_id: lead.id });
      ctx.onError({ step: "score", lead_id: lead.id }, err);
    }
  }

  if (ctx.options.daysAhead !== false) await checkDaysAhead(lead, prev, sameEvidence, ctx);
  lead.worth_a_call = isWorthACall(lead);
  return lead;
}

async function checkDaysAhead(lead, prev, sameEvidence, ctx) {
  const prevPublic = toDay(prev?.first_public_at);
  // A found date never changes; "still invisible" is re-checked once the evidence changes.
  const reuse = prev && (prevPublic || (sameEvidence && toBool(prev.still_invisible) === true));
  if (reuse) {
    lead.first_public_at = prevPublic;
    const old = (parseJson(prev.signals, []) || []).find((s) => s?.kind === PUBLIC_SIGNAL_KIND);
    if (old) lead.signals.push(old);
  } else {
    try {
      const found = await findFirstPublic(lead, ctx.llm);
      ctx.track(found.usage, { step: "days_ahead", lead_id: lead.id });
      lead.first_public_at = found.first_public_at;
      const signal = publicSignal(found);
      if (signal) lead.signals.push(signal);
    } catch (err) {
      if (err.usage) ctx.track(err.usage, { step: "days_ahead", lead_id: lead.id });
      ctx.onError({ step: "days_ahead", lead_id: lead.id }, err);
      return;
    }
  }
  lead.signals.sort((a, b) => String(a.happened_at || "9999").localeCompare(String(b.happened_at || "9999")));
  lead.still_invisible = !lead.first_public_at;
  lead.days_ahead = daysAhead(lead.first_trace_at, lead.first_public_at, ctx.today);
}

function byPriority(a, b) {
  return (
    Number(b.worth_a_call) - Number(a.worth_a_call) ||
    Number(b.label === "vc_backable") - Number(a.label === "vc_backable") ||
    (b.fit_score ?? -1) - (a.fit_score ?? -1) ||
    (b.team_score ?? -1) - (a.team_score ?? -1) ||
    b.source_count - a.source_count
  );
}

/**
 * body: { traces, previous_leads?, options?: { daysAhead } }
 * Returns { leads, rows, trace_updates, funnel, cost, errors }.
 */
export async function runBrain(body, { llm = structured, today = new Date().toISOString().slice(0, 10) } = {}) {
  const usages = [];
  const errors = [];
  const ctx = {
    llm,
    today,
    options: body.options || {},
    track: (usage, meta) => usages.push({ ...usage, ...meta }),
    onError: (meta, err) => errors.push({ ...meta, error: err?.message || String(err) }),
  };

  const traces = (body.traces || []).map((t) => ({ ...t, extraction: parseJson(t.extraction, null) }));
  const previous = body.previous_leads || [];

  const trace_updates = await extractAll(traces, ctx);

  const mentions = [...mentionsFromLeads(previous), ...mentionsFromTraces(traces)];
  const { groups } = await converge(mentions, ctx);

  const usedIds = new Set();
  const built = groups.map((g) => buildLead(g, usedIds));
  const prevById = new Map(previous.map((p) => [p.id, p]));
  const leads = (await mapLimit(built, CONCURRENCY, (b) => judgeLead(b, prevById.get(b.lead.id), ctx))).sort(byPriority);

  const traceIds = new Set([...traces.map((t) => t.id), ...leads.flatMap((l) => l.signals.map((s) => s.trace_id))]);
  traceIds.delete(null);
  traceIds.delete(undefined);
  const vcCount = leads.filter((l) => l.label === "vc_backable").length;
  const funnel = {
    traces: traceIds.size,
    teams: leads.length,
    vc_backable: vcCount,
    worth_a_call: leads.filter((l) => l.worth_a_call).length,
  };

  return {
    leads,
    rows: leads.map(toRow),
    trace_updates,
    funnel,
    cost: costSummary(usages, { traceCount: traces.length, leadCount: leads.length, vcCount }),
    errors,
  };
}
