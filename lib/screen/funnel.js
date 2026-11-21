// Funnel numbers for /proof/funnel and the home page, from /api/funnel (flow 44) or its snapshot. Pure functions.
import { STAGE0_RULES, VERDICTS } from "./criteria";
import { int, isNum, usd, words } from "./format";

const count = (f, key) => {
  const n = f?.stages?.find((s) => s.key === key)?.count;
  return isNum(n) ? Number(n) : null;
};
const step = (f, re) => (f?.cost?.by_step || []).filter((s) => re.test(s.step || ""));
const sumUsd = (steps) => steps.reduce((t, s) => t + (Number(s.usd) || 0), 0);
const sumCalls = (steps) => steps.reduce((t, s) => t + (Number(s.calls) || 0), 0);

/** The numbers every page needs: traces, survivors, call now, and costs per step. */
export function funnelNumbers(f) {
  const traces = count(f, "traces_in") ?? f?.traces?.total ?? null;
  const skipped = count(f, "stage0_skipped");
  const read = count(f, "read_by_mini");
  const scored = count(f, "scored_v2");
  const deep = count(f, "deep_checked");
  const stage1 = step(f, /^stage 1/);
  const strong = step(f, /^strong scoring/);
  const deepSteps = step(f, /^deep checks/);
  const strongCalls = sumCalls(strong) || scored;
  return {
    traces,
    kept: traces !== null && skipped !== null ? traces - skipped : null,
    read,
    teams: count(f, "leads") ?? f?.leads?.live ?? null,
    survivors: count(f, "survivors"),
    scored,
    deep,
    callNow: count(f, "call_now") ?? f?.leads?.call_now ?? null,
    thinParked: count(f, "thin_no_site"),
    stage1Usd: stage1.length ? sumUsd(stage1) : null,
    strongUsd: strong.length ? sumUsd(strong) : null,
    deepUsd: deepSteps.length ? sumUsd(deepSteps) : null,
    perTrace: stage1.length && read ? sumUsd(stage1) / read : null,
    perStrong: strong.length && strongCalls ? sumUsd(strong) / strongCalls : null,
    perDeep: deepSteps.length && deep ? sumUsd(deepSteps) / deep : null,
    perCallNow: isNum(f?.cost?.per_call_now_usd) ? Number(f.cost.per_call_now_usd) : null,
    totalUsd: isNum(f?.cost?.total_usd) ? Number(f.cost.total_usd) : null,
  };
}


// ---- The last run's cost ------------------------------------------------------------------------------------------
// A run = the Run costs rows (flow 44, cost.rows) clustered by time: a gap of more than 30 minutes starts a new run.
// The last run = the newest cluster. Deep checks (flow 17) log no Run costs row, so their cost comes from the leads whose
// deep_checked_at falls inside the window (with the same 30-minute allowance after the last row, because 17 runs last).
const GAP_MS = 30 * 60 * 1000;
const t = (iso) => Date.parse(iso || "");

export function runs(rows) {
  const sorted = (rows || []).filter((r) => Number.isFinite(t(r.run_at))).sort((a, b) => t(a.run_at) - t(b.run_at));
  const out = [];
  for (const r of sorted) {
    const cur = out[out.length - 1];
    if (cur && t(r.run_at) - t(cur.end) <= GAP_MS) { cur.rows.push(r); cur.end = r.run_at; }
    else out.push({ start: r.run_at, end: r.run_at, rows: [r] });
  }
  return out;
}

/** What the newest run cost, from flow 44's cost.rows and the leads. null when flow 44 sent no rows. */
export function lastRun(f, leads = []) {
  const all = runs(f?.cost?.rows);
  const run = all[all.length - 1];
  if (!run) return null;
  const from = t(run.start);
  const to = t(run.end) + GAP_MS;
  const sum = (re) => run.rows.filter((r) => re.test(`${r.flow} ${r.step}`)).reduce((a, r) => ({ usd: a.usd + (Number(r.usd) || 0), calls: a.calls + (Number(r.calls) || 0) }), { usd: 0, calls: 0 });
  const stage1 = sum(/^10 |stage 1 read/);
  const strong = sum(/^15 |strong scoring/);
  const age = sum(/^35 /);
  const deepLeads = (leads || []).filter((l) => { const d = t(l.deep_checked_at); return Number.isFinite(d) && d >= from && d <= to; });
  const deep = { usd: deepLeads.reduce((a, l) => a + (Number(l.deep_cost_usd) || 0), 0), count: deepLeads.length };
  const rowsUsd = run.rows.reduce((a, r) => a + (Number(r.usd) || 0), 0);
  const total = rowsUsd + deep.usd;
  const callNew = (leads || []).filter((l) => l.verdict === "call_now" && [l.updatedAt, l.createdAt, l.scored_at].some((x) => { const d = t(x); return Number.isFinite(d) && d >= from && d <= to; }));
  return {
    start: run.start,
    end: run.end,
    runCount: all.length,
    rowCount: run.rows.length,
    rowsUsd,
    total,
    stage1,
    strong,
    age,
    deep,
    perTrace: stage1.calls ? stage1.usd / stage1.calls : null,
    perStrong: strong.calls ? strong.usd / strong.calls : null,
    perDeep: deep.count ? deep.usd / deep.count : null,
    callNow: { count: callNew.length, per: callNew.length ? total / callNew.length : null },
    allTimeUsd: isNum(f?.cost?.total_usd) ? Number(f.cost.total_usd) : null,
  };
}

const total = (v) => (v === null ? "Not known" : `${usd(v)} in total`);
const about = (v) => (v === null ? "Not known" : `About ${usd(v)} in total`);

/** Everything design/reference/funnel.dc.html shows. */
export function funnelPage(f, { mocked = false, run = null } = {}) {
  const n = funnelNumbers(f);
  const max = n.traces || 1;
  const rows = [
    ["Traces found", n.traces, "Scrapers", "#e3eaee", "#0d2b3d", "none"],
    ["Kept by the code filter", n.kept, "Free", "#c7d3db", "#0d2b3d", "none"],
    ["Read by the small model", n.read, run ? total(run.stage1.usd) : total(n.stage1Usd), "#8fa6b4", "#0d2b3d", "none"],
    ["Teams", n.teams, "Merged in code", "#4f7891", "#ffffff", "none"],
    ["Past the HTGF gates", n.survivors, "Free", "#2f6385", "#ffffff", "none"],
    ["Scored by the strong model", n.scored, run ? about(run.strong.usd) : about(n.strongUsd), "#1a5276", "#ffffff", "none"],
    ["Deep-checked", n.deep, run ? about(run.deep.usd) : about(n.deepUsd), "#0d2b3d", "#ffffff", "none"],
    ["To call now", n.callNow, mocked ? "Snapshot" : "Live", "#b4363b", "#ffffff", "0 0 0 6px rgba(180,54,59,0.14)"],
  ];
  const stages = rows.map(([label, value, cost, color, ink, glow]) => ({
    label,
    n: value === null ? "–" : int(value),
    cost,
    color,
    ink,
    glow,
    pct: value === null ? 6 : Math.max(6, Math.round((value / max) * 100)),
  }));
  const byRule = f?.traces?.stage0_skipped_by_rule || f?.stages?.find((s) => s.key === "stage0_skipped")?.by_rule || {};
  const codeCuts = Object.entries(byRule)
    .map(([rule, value]) => ({ label: STAGE0_RULES[rule] || rule.replace(/_/g, " "), n: Number(value) || 0 }))
    .sort((a, b) => b.n - a.n);
  const byVerdict = f?.leads?.by_verdict || {};
  const verdicts = VERDICTS.filter((v) => isNum(byVerdict[v.key])).map((v) => ({ ...v, n: Number(byVerdict[v.key]) }));
  // "What the last run cost": every figure from the newest run (lastRun); without cost rows, the all-time figures.
  const costs = run
    ? [
        { n: run.perTrace === null ? "Not known" : usd(run.perTrace, 3), label: "per trace, first read", color: "#0d2b3d" },
        { n: run.perStrong === null ? "Not known" : usd(run.perStrong), label: "per team scored by the strong model", color: "#0d2b3d" },
        { n: run.perDeep === null ? "Not known" : usd(run.perDeep), label: "per team deep-checked", color: "#1a5276" },
        run.callNow.per === null
          ? { n: "–", label: "no new call-now lead this run", color: "#4f6573" }
          : { n: usd(run.callNow.per), label: `per new call-now lead (${run.callNow.count} this run)`, color: "#0d2b3d" },
        { n: usd(run.total), label: "the whole run", color: "#4f6573" },
      ]
    : [
        { n: n.perTrace === null ? "Not known" : usd(n.perTrace, 3), label: "per trace, first read", color: "#0d2b3d" },
        { n: n.perStrong === null ? "Not known" : usd(n.perStrong), label: "per team scored by the strong model", color: "#0d2b3d" },
        { n: n.perDeep === null ? "Not known" : usd(n.perDeep), label: "per team deep-checked", color: "#1a5276" },
        { n: n.perCallNow === null ? "Not known" : usd(n.perCallNow), label: "per team on the call list", color: "#0d2b3d" },
      ];

  return {
    title: [`From ${n.traces === null ? "every" : int(n.traces)} signals`, `to ${n.callNow === null ? "a few" : words(n.callNow)} ${n.callNow === 1 ? "call" : "calls"}.`],
    stages,
    codeCuts,
    parkedNote: n.thinParked
      ? `${int(n.thinParked)} thin entries are parked, not dropped: no usable website yet. They return as soon as one is found.`
      : "Thin entries without a usable website are parked, not dropped. They return as soon as one is found.",
    teamsLabel: `Verdicts on ${n.teams === null ? "all" : int(n.teams)} teams`,
    verdicts,
    costs,
    numbers: n,
  };
}

// ---- Honest lower funnel and the drop-out dive (from the Leads rows, not flow 44) ------------------------------
// Flow 44 counts "past the gates" by today's verdict but "scored" by score_version, so leads scored first and moved to
// too_late / out_of_scope later count as scored but not as past the gates (284 > 279 on 21 Nov). Here every stage from
// "Past the HTGF gates" down is computed from the lead rows and is a subset of the stage above.

const SURVIVOR = ["call_now", "watchlist", "needs_enrichment"];
const LATE_DROP = ["too_late", "out_of_scope", "htgf_portfolio"];
const isScored = (l) => Number(l.score_version) === 2;
// verdict_reason as one readable line: drop the rule prefix ("stage (", "no_funding (") and the model tag.
const reasonText = (l) => {
  let t = String(l.verdict_reason || "").replace(/^not yet call now:\s*/i, "").replace(/\s*\((strong model|stage 1)[^)]*\)/gi, "").trim();
  const rule = t.match(/^(stage|no_funding|sector|germany|legal_entity)\s*\((.*)\)$/s);
  if (rule) t = rule[2];
  t = t.replace(/^older than 3 years: /i, "Older than 3 years, ").replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Plain-sentence reason group for a lead that stopped after `stage`. */
export function dropReason(l, stage) {
  const r = String(l.verdict_reason || "").toLowerCase();
  const flight = String(l.flight_risk || "").toLowerCase();
  const rounds = Array.isArray(l.age_check?.rounds) ? l.age_check.rounds : [];
  if (l.verdict === "too_late") {
    if (r.startsWith("stage") || r.includes("older than")) return "Older than three years";
    if (r.includes("web check") || /series|seed_vc|led by|vc/.test(r) || rounds.some((x) => /series|seed/i.test(x?.type || ""))) return "VC round found";
    if (r.includes("disclosed")) return "Raised €3M or more";
    return "Too late for a first round";
  }
  if (l.verdict === "out_of_scope") return r.includes("sector") ? "Outside HTGF's sectors" : "Not based in Germany";
  if (l.verdict === "htgf_portfolio") return "Already in HTGF's portfolio";
  if (l.verdict === "not_high_tech") return "Tech depth below the bar";
  if (l.verdict === "not_a_startup") return r.includes("research") || r.includes("student") ? "Research or student team, no company yet" : "Not a startup";
  if (stage === "gates" && !isScored(l)) {
    if (r.includes("tech depth unknown")) return "Not scored yet: too little evidence";
    if (r.includes("team")) return "Not scored yet: founders unknown";
    return "Not scored yet: waiting for the strong model";
  }
  if (flight === "high") return "Flight risk: high";
  if (r.includes("fit") && r.includes("<")) return "Fit below 55";
  if (r.includes("outside validation")) return "No outside proof yet";
  if (r.includes("age unknown")) return "Age not known yet";
  if (r.includes("tech depth unknown")) return "Tech depth unknown: too little evidence";
  if (r.includes("team criteria unknown") || r.includes("no team criterion")) return "Team mostly unknown";
  if (stage === "standing" && l.verdict === "watchlist") return "On the watchlist, not deep-checked yet";
  return `Now: ${String(l.verdict || "not classified").replace(/_/g, " ")}`;
}

const STAGES = [
  { key: "gates", label: "Past the HTGF gates", test: (l) => isScored(l) || SURVIVOR.includes(l.verdict) },
  { key: "scored", label: "Scored by the strong model", test: (l) => isScored(l) },
  { key: "standing", label: "Still standing after the age and funding check", test: (l) => !LATE_DROP.includes(l.verdict) },
  { key: "deep", label: "Deep-checked", test: (l) => Boolean(l.deep_checked_at) },
  { key: "call", label: "To call now", test: (l) => l.verdict === "call_now" },
];

/** Lead-based stages with their drop-outs. Throws in development when a stage is not a subset of the one above. */
export function lowerFunnel(leads) {
  const live = (leads || []).filter((l) => !String(l.verdict || "").startsWith("merged_into:"));
  let current = live;
  const stages = [];
  const problems = [];
  STAGES.forEach((s, i) => {
    const members = current.filter(s.test);
    // call_now must also be inside the stage above; anything outside is a mismatch, not silently dropped.
    if (s.key === "call") {
      const outside = live.filter((l) => l.verdict === "call_now" && !current.includes(l));
      if (outside.length) problems.push(`${outside.length} call_now lead(s) are not in "${STAGES[i - 1].label}": ${outside.map((l) => l.name).join(", ")}`);
    }
    stages.push({ key: s.key, label: s.label, members });
    current = members;
  });
  stages.forEach((s, i) => {
    const next = stages[i + 1];
    if (!next) return;
    const nextSet = new Set(next.members);
    s.dropped = s.members.filter((l) => !nextSet.has(l));
    if (next.members.length > s.members.length) problems.push(`"${next.label}" (${next.members.length}) is bigger than "${s.label}" (${s.members.length})`);
    if (s.dropped.length + next.members.length !== s.members.length) problems.push(`"${s.label}": ${s.dropped.length} drop-outs + ${next.members.length} = ${s.dropped.length + next.members.length}, not ${s.members.length}`);
    s.next = next.label;
  });
  if (problems.length && process.env.NODE_ENV !== "production") throw new Error(`Funnel mismatch: ${problems.join("; ")}`);
  return { stages, problems };
}

const BEAM = {
  gates: ["#2f6385", "#ffffff", "none"],
  scored: ["#1a5276", "#ffffff", "none"],
  standing: ["#144461", "#ffffff", "none"],
  deep: ["#0d2b3d", "#ffffff", "none"],
  call: ["#b4363b", "#ffffff", "0 0 0 6px rgba(180,54,59,0.14)"],
};

/**
 * The funnel page with honest numbers: flow 44 for traces, code filter, small model and teams (and every cost),
 * the Leads rows from "Past the HTGF gates" down. Without the live Leads table (snapshot), flow 44's counts are shown
 * for the lower stages and the dive is off, said out loud.
 */
export function honestFunnel(f, leadsData, { mocked = false } = {}) {
  const run = leadsData && !leadsData.mocked ? lastRun(f, leadsData.leads) : lastRun(f, []);
  const base = { ...funnelPage(f, { mocked, run }), run };
  const n = base.numbers;
  const live = leadsData && !leadsData.mocked && Array.isArray(leadsData.leads) && leadsData.leads.length > 50;
  if (!live) return { ...base, diveNote: "Who stopped where needs the live Leads table; n8n not reachable, so the lower stages show flow 44's counts.", old: null, problems: [] };
  const { stages, problems } = lowerFunnel(leadsData.leads);
  const max = n.traces || 1;
  const cost = { gates: "Free", scored: base.stages[5].cost, standing: run ? `About ${usd(run.age.usd)} in total` : "Web check", deep: base.stages[6].cost, call: mocked ? "Snapshot" : "Live" };
  const lower = stages.map((s) => {
    const [color, ink, glow] = BEAM[s.key];
    const dropped = s.dropped ? s.dropped.length : 0;
    return {
      key: s.key,
      label: s.label,
      n: int(s.members.length),
      count: s.members.length,
      cost: cost[s.key],
      color, ink, glow,
      pct: Math.max(6, Math.round((s.members.length / max) * 100)),
      dropped,
      dropPct: dropped && s.members.length ? Math.round((dropped / s.members.length) * 100) : 0,
      filteredHref: s.next ? `/proof/funnel/filtered?stage=${s.key}` : "",
      next: s.next || "",
    };
  });
  const calls = stages[stages.length - 1].members.length;
  return {
    ...base,
    title: [base.title[0], `to ${words(calls)} ${calls === 1 ? "call" : "calls"}.`],
    stages: [...base.stages.slice(0, 4), ...lower],
    lowerFrom: 4,
    old: { survivors: n.survivors, scored: n.scored, deep: n.deep, callNow: n.callNow },
    problems,
  };
}
