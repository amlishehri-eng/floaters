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
