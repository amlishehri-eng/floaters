// Labs and blind backtest for /proof/labs, /proof/methodology and the home backtest band.
// Input: lib/n8n.js getExtras() (flow 46 or data/labs.sample.json + data/backtest.sample.json). Pure functions.
import { clip, int, isNum, words } from "./format";

const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

const FIELD_NAMES = { "biochemistry, genetics, molecular biology": "molecular biology", "immunology and microbiology": "immunology" };
const fieldName = (k) => FIELD_NAMES[k] || k;
const listWords = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** The paper flow 40's note points to, and what it hints at ("3D segmentation tools"), read from the English note. */
function paperHint(note) {
  const t = String(note || "").replace(/\n+/g, " ");
  const quoted = t.match(/[“"']([^“”"']{12,200})[”"']/);
  const after = t.match(/(?:paper hinting at a startup|hinting at a startup):\s*([^;]{12,200}?)\.?(?:\s*$|;)/i);
  const title = (quoted?.[1] || after?.[1] || "").trim().replace(/\.$/, "");
  const hint = (t.match(/(?:suggests|hints at)\s+([^.;]{6,120})/i)?.[1] || "").trim();
  return { title, hint };
}

/**
 * One plain paragraph per lab, built from the numbers instead of the model's note: thousands separators, no raw
 * "(gap score 44/100)" in the prose, English only.
 */
export function labWhy(l) {
  const fields = Object.entries(obj(l.fields)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => fieldName(k));
  const works = isNum(l.works_24m) ? Number(l.works_24m) : null;
  const spin = isNum(l.spinoffs_known) ? Number(l.spinoffs_known) : null;
  const parts = [];
  if (works !== null) parts.push(`${int(works)} papers in the last 24 months${fields.length ? `, most of them in ${listWords(fields)}` : ""}.`);
  if (spin !== null) {
    const per = works && spin ? Math.round(works / spin) : null;
    parts.push(spin === 0 ? "No spin-off we know of so far." : `Only ${int(spin)} spin-off${spin === 1 ? "" : "s"} we know of so far${per ? `, about one for every ${int(per)} papers` : ""}.`);
  }
  const { title, hint } = paperHint(l.why_visit);
  if (title) parts.push(hint ? `The paper “${title}” points to ${hint.replace(/^(a|an)\s+/i, (m) => m.toLowerCase())}.` : `A paper that hints at a startup: “${title}”.`);
  return parts.join(" ");
}

export function labsPage(labs) {
  const list = arr(labs).filter((l) => l && l.name);
  const top = Math.max(1, ...list.map((l) => Number(l.gap_score) || 0));
  return list.map((l, i) => {
    const fields = Object.entries(obj(l.fields)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => fieldName(k));
    const paper = arr(l.top_works)[0] || null;
    return {
      key: l.lab_key || l.name,
      rank: i + 1,
      name: l.name,
      city: l.city || "City not known",
      fields: fields.length ? fields.join(", ") : "fields not known",
      why: clip(labWhy(l), 360) || "Not checked yet. The reason to visit is written for the top ten after the next lab run.",
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

// A round axis end: the first of 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10 × 10^k at or above v.
export function niceMax(v) {
  if (!(v > 0)) return 1;
  const k = 10 ** Math.floor(Math.log10(v));
  return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * k).find((x) => x >= v);
}
const ticks = (max) => [0, max / 2, max].map((v) => ({ v, label: int(v), pct: (v / max) * 100 }));
// A gap this high makes the top lab worth a visit now: the one place the Labs page uses Guest Red.
export const LAB_CALL_GAP = 40;

/**
 * The overview chart (DESIGN.md, labs): papers in 24 months (Adriatic), spin-offs we know (Stone) and the gap score
 * (Harbour Ink; Guest Red only for the top lab when its gap is at least LAB_CALL_GAP), one row per lab, each column on
 * its own axis from 0 to a round maximum. summary is the same story in one or two sentences for every reader.
 */
export function labsChart(labs) {
  const list = arr(labs).filter((l) => l && l.name && isNum(l.works_24m) && isNum(l.spinoffs_known) && isNum(l.gap_score));
  if (!list.length) return null;
  const worksMax = niceMax(Math.max(...list.map((l) => Number(l.works_24m))));
  const spinMax = niceMax(Math.max(...list.map((l) => Number(l.spinoffs_known))));
  const rows = list.map((l, i) => {
    const works = Number(l.works_24m);
    const spin = Number(l.spinoffs_known);
    const gap = Number(l.gap_score);
    return {
      key: l.lab_key || l.name,
      name: l.name,
      works: { n: int(works), pct: (works / worksMax) * 100, tip: `${l.name}: ${int(works)} papers in 24 months` },
      spin: { n: int(spin), pct: (spin / spinMax) * 100, tip: `${l.name}: ${int(spin)} spin-off${spin === 1 ? "" : "s"} we know` },
      gap: { n: int(gap), pct: gap, tip: `${l.name}: gap score ${int(gap)} of 100`, call: i === 0 && gap >= LAB_CALL_GAP },
    };
  });
  const first = list[0];
  const most = [...list].sort((a, b) => b.works_24m - a.works_24m)[0];
  const summary = [
    `${first.name} has the biggest gap: ${int(first.works_24m)} papers in 24 months and ${int(first.spinoffs_known)} spin-off${Number(first.spinoffs_known) === 1 ? "" : "s"} we know, gap score ${int(first.gap_score)} of 100.`,
    most.name !== first.name ? `${most.name} publishes the most (${int(most.works_24m)} papers) but already has ${int(most.spinoffs_known)} known spin-offs, so its gap is smaller.` : "",
  ].filter(Boolean).join(" ");
  return {
    rows,
    axes: { works: ticks(worksMax), spin: ticks(spinMax), gap: ticks(100) },
    summary,
  };
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
      { label: "HTGF portfolio called deep tech", n: p.deep_tech, of: p.n, pct: pct(p.deep_tech, p.n), color: "#1a5276" },
      { label: "Teams from our sources called deep tech", n: c.deep_tech, of: c.n, pct: pct(c.deep_tech, c.n), color: "#8fa6b4" },
    ],
    sentence: `The engine called ${int(p.deep_tech)} of ${int(p.n)} portfolio companies deep tech, against ${int(c.deep_tech)} of ${int(c.n)} teams from our own sources.`,
    table: [
      { stage: "Pass the code filter", p: int(p.stage0_pass), c: int(c.stage0_pass), pInk: "#0d2b3d" },
      { stage: "Called deep tech", p: int(p.deep_tech), c: int(c.deep_tech), pInk: "#1a5276" },
      { stage: "Stay in the funnel", p: int(p.kept), c: int(c.kept), pInk: "#0d2b3d" },
      { stage: "Call now", p: int(p.call_now), c: int(c.call_now), pInk: "#0d2b3d" },
    ],
    footnote: bt.run_at === ANALYSED_RUN
      ? "Six misses were the wrong archived page, from before the company existed. The test also stops before the strong model, so the live pipeline does better than this."
      : "The test stops before the strong model, so the live pipeline does better than this.",
  };
}
