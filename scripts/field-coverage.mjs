#!/usr/bin/env node
// Field coverage: every column of the n8n Leads table must either reach the screen or be on the internal list below
// (design/DESIGN.md section 7, design/reference/field-map.dc.html). Exits 1 when a column is neither.
//
//   node scripts/field-coverage.mjs            # columns from flow 20 (N8N_LEADS_URL), else data/leads.live-snapshot.json
//
// "Shown" = the column name is read as `lead.<column>` / `l.<column>` by the screen code (lib/screen/*.js, the pages),
// is one of the memo export fields, or is turned into a shown field by lib/n8n.js (VIA below).
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const LEADS_URL = process.env.N8N_LEADS_URL || "https://floaters.app.n8n.cloud/webhook/htgf-leads";

// Columns kept in n8n on purpose (not shown). Keep each reason short.
const INTERNAL = {
  id: "n8n row id",
  createdAt: "n8n row timestamp",
  updatedAt: "n8n row timestamp",
  lead_key: "the lead's key, used for links and votes, not shown as text",
  label: "old noise-filter label, replaced by verdict",
  label_reason: "old noise-filter reason, replaced by verdict_reason",
  score_reason: "old one-line reason, fit_reason is shown",
  evidence_hash: "decides whether scores are recomputed",
  score_version: "pipeline bookkeeping",
  scored_at: "pipeline bookkeeping",
  fit_score_v2: "rollback copy of the old fit score",
  fit_version: "decides how lib/n8n.js reads the fit breakdown",
  type_trace_ids: "trace ids behind lead_type, type_reason is shown",
  status: "pipeline bookkeeping",
  news_status: "press-check bookkeeping, the result is shown as days ahead",
  deep_cost_usd: "cost bookkeeping, totals are on the funnel page",
  deep_signals: "raw deep-check output, its parts are shown as the deep-check fields",
  country: "always DE after the Germany gate",
  founded_year: "age is shown through the HTGF check",
  tier: "same as verdict",
  tier_reason: "same as verdict_reason",
  eligible: "summary of eligibility, the five checks are shown",
  site_checked_at: "website-check bookkeeping",
};

// Columns lib/n8n.js turns into a field the screen shows.
const VIA = {
  fit_breakdown: "fit_criteria",
  capital_need: "fit_criteria",
  team_breakdown: "team_criteria",
  timing_breakdown: "timing_criteria",
  trace_ids: "signals",
  sources: "signals",
};

function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.js$/.test(name)) out.push(p);
  }
  return out;
}

function screenReads() {
  const sources = [
    ...files(path.join(ROOT, "lib/screen")),
    path.join(ROOT, "app/page.js"),
    ...["live", "funnel", "labs", "methodology", "candidates", "company"].flatMap((d) => files(path.join(ROOT, "app/proof", d))),
  ];
  const reads = new Map();
  for (const file of sources) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/\b(?:lead|l|top)\.([a-zA-Z_][a-zA-Z0-9_]*)/g)) {
      if (!reads.has(m[1])) reads.set(m[1], path.relative(ROOT, file));
    }
    const memo = text.match(/MEMO_FIELDS = \[([\s\S]*?)\]/);
    if (memo) for (const m of memo[1].matchAll(/"([a-z_]+)"/g)) if (!reads.has(m[1])) reads.set(m[1], `${path.relative(ROOT, file)} (memo)`);
  }
  return reads;
}

async function columns() {
  try {
    const res = await fetch(LEADS_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`flow 20 answered ${res.status}`);
    const data = await res.json();
    const cols = new Set();
    for (const row of data.leads || []) for (const k of Object.keys(row)) cols.add(k);
    if (!cols.size) throw new Error("flow 20 sent no rows");
    return { cols: [...cols].sort(), from: `live webhook ${LEADS_URL}` };
  } catch (err) {
    const snap = JSON.parse(readFileSync(path.join(ROOT, "data/leads.live-snapshot.json"), "utf8"));
    const cols = new Set(snap.table?.columns || []);
    for (const row of snap.leads || []) for (const k of Object.keys(row)) cols.add(k);
    return { cols: [...cols].sort(), from: `data/leads.live-snapshot.json (${snap.as_of}); live webhook: ${err.message}` };
  }
}

const { cols, from } = await columns();
const reads = screenReads();
const SYSTEM = ["id", "createdAt", "updatedAt"]; // n8n's own row columns (the screen's lead.id is lead_key)
const rows = cols.map((c) => {
  if (SYSTEM.includes(c)) return { c, kind: "internal", where: INTERNAL[c] };
  if (reads.has(c)) return { c, kind: "shown", where: reads.get(c) };
  if (c === "priority") return { c, kind: "shown", where: "as the order of the call list and the home page's top lead" };
  if (VIA[c] && reads.has(VIA[c])) return { c, kind: "shown", where: `via ${VIA[c]} (${reads.get(VIA[c])})` };
  if (INTERNAL[c]) return { c, kind: "internal", where: INTERNAL[c] };
  return { c, kind: "MISSING", where: "neither shown nor on the internal list" };
});

console.log(`Leads columns: ${cols.length}, from ${from}\n`);
for (const r of rows) console.log(`${r.kind.padEnd(8)} ${r.c.padEnd(22)} ${r.where}`);
const missing = rows.filter((r) => r.kind === "MISSING");
const stale = Object.keys(INTERNAL).filter((k) => !cols.includes(k));
if (stale.length) console.log(`\nNote: on the internal list but not a column (any more): ${stale.join(", ")}`);
console.log(`\n${rows.filter((r) => r.kind === "shown").length} shown, ${rows.filter((r) => r.kind === "internal").length} internal, ${missing.length} missing`);
if (missing.length) {
  console.error(`FAIL: place these columns on the screen (design/reference/field-map.dc.html) or add them to INTERNAL: ${missing.map((r) => r.c).join(", ")}`);
  process.exit(1);
}
console.log("PASS");
