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

const total = (v) => (v === null ? "Not known" : `${usd(v)} in total`);
const about = (v) => (v === null ? "Not known" : `About ${usd(v)} in total`);

/** Everything design/reference/funnel.dc.html shows. */
export function funnelPage(f, { mocked = false } = {}) {
  const n = funnelNumbers(f);
  const max = n.traces || 1;
  const rows = [
    ["Traces found", n.traces, "Scrapers", "rgba(245,245,247,0.14)", "#d2d2d7", "none"],
    ["Kept by the code filter", n.kept, "Free", "rgba(245,245,247,0.2)", "#f5f5f7", "none"],
    ["Read by the small model", n.read, total(n.stage1Usd), "rgba(51,209,255,0.28)", "#f5f5f7", "none"],
    ["Teams", n.teams, "Merged in code", "rgba(51,209,255,0.38)", "#f5f5f7", "none"],
    ["Past the HTGF gates", n.survivors, "Free", "rgba(51,209,255,0.55)", "#000000", "0 0 24px rgba(51,209,255,0.25)"],
    ["Scored by the strong model", n.scored, about(n.strongUsd), "rgba(51,209,255,0.8)", "#000000", "0 0 28px rgba(51,209,255,0.35)"],
    ["Deep-checked", n.deep, about(n.deepUsd), "#33d1ff", "#000000", "0 0 32px rgba(51,209,255,0.5)"],
    ["To call now", n.callNow, mocked ? "Snapshot" : "Live", "#ff5b3a", "#000000", "0 0 36px rgba(255,91,58,0.7)"],
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
  const costs = [
    { n: n.perTrace === null ? "Not known" : usd(n.perTrace, 3), label: "per trace, first read", color: "#f5f5f7" },
    { n: n.perStrong === null ? "Not known" : usd(n.perStrong), label: "per team scored by the strong model", color: "#f5f5f7" },
    { n: n.perDeep === null ? "Not known" : usd(n.perDeep), label: "per team deep-checked", color: "#33d1ff" },
    { n: n.perCallNow === null ? "Not known" : usd(n.perCallNow), label: "per team on the call list", color: "#ff8a70" },
    { n: n.totalUsd === null ? "Not known" : usd(n.totalUsd), label: "all model spend so far", color: "#a1a1a6" },
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
