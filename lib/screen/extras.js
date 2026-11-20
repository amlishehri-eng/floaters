// Labs and blind backtest for /proof/labs, /proof/methodology and the home backtest band.
// Input: lib/n8n.js getExtras() (flow 46 or data/labs.sample.json + data/backtest.sample.json). Pure functions.
import { clip, int, isNum, words } from "./format";

const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

export function labsPage(labs) {
  const list = arr(labs).filter((l) => l && l.name);
  const top = Math.max(1, ...list.map((l) => Number(l.gap_score) || 0));
  return list.map((l, i) => {
    const fields = Object.entries(obj(l.fields)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
    const paper = arr(l.top_works)[0] || null;
    return {
      key: l.lab_key || l.name,
      rank: i + 1,
      name: l.name,
      city: l.city || "City not known",
      fields: fields.length ? fields.join(", ") : "fields not known",
      why: clip(String(l.why_visit || "").replace(/\n+/g, " "), 320) || "Not checked yet. The reason to visit is written for the top ten after the next lab run.",
      paper: paper?.title || "",
      paperUrl: paper?.openalex || paper?.doi || "",
      gap: isNum(l.gap_score) ? int(l.gap_score) : "–",
      gapPct: isNum(l.gap_score) ? Math.round((Number(l.gap_score) / top) * 100) : 0,
      works: isNum(l.works_24m) ? int(l.works_24m) : "not known",
      spinoffs: isNum(l.spinoffs_known) ? int(l.spinoffs_known) : "not known",
      updatedAt: l.updated_at || null,
    };
  });
}

// The run Nils analysed by hand in STATUS.md (misses by cause). The sentence about it is only shown for that run.
const ANALYSED_RUN = "2026-11-20T21:31:04.847Z";

/** Backtest numbers for the home band and the Method table. null fields stay out instead of showing zeros. */
export function backtestView(bt) {
  if (!bt || !bt.portfolio || !bt.control) return null;
  const p = bt.portfolio;
  const c = bt.control;
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  return {
    runAt: bt.run_at || null,
    n: p.n,
    controlN: c.n,
    nWords: words(p.n, true),
    controlWords: words(c.n),
    bars: [
      { label: "HTGF portfolio called deep tech", n: p.deep_tech, of: p.n, pct: pct(p.deep_tech, p.n), color: "#0a6e99" },
      { label: "Teams from our sources called deep tech", n: c.deep_tech, of: c.n, pct: pct(c.deep_tech, c.n), color: "#b8bcc6" },
    ],
    sentence: `The engine called ${int(p.deep_tech)} of ${int(p.n)} portfolio companies deep tech, against ${int(c.deep_tech)} of ${int(c.n)} teams from our own sources.`,
    table: [
      { stage: "Pass the code filter", p: int(p.stage0_pass), c: int(c.stage0_pass), pInk: "#1d1d1f" },
      { stage: "Called deep tech", p: int(p.deep_tech), c: int(c.deep_tech), pInk: "#0a6e99" },
      { stage: "Stay in the funnel", p: int(p.kept), c: int(c.kept), pInk: "#1d1d1f" },
      { stage: "Call now", p: int(p.call_now), c: int(c.call_now), pInk: "#d93d1e" },
    ],
    footnote: bt.run_at === ANALYSED_RUN
      ? "Six misses were the wrong archived page, from before the company existed. The test also stops before the strong model, so the live pipeline does better than this."
      : "The test stops before the strong model, so the live pipeline does better than this.",
  };
}
