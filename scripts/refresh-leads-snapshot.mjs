#!/usr/bin/env node
// Refresh the Leads snapshot the screen falls back to when n8n does not answer.
//   node scripts/refresh-leads-snapshot.mjs
// Reads flow 20 "Leads for the screen" (N8N_LEADS_URL, default the HTGF webhook) and flow 44 "Funnel stats"
// (N8N_FUNNEL_URL) in the same minute, then rewrites
//   data/leads.live-snapshot.json  the rows the screen shows (verdict call_now, watchlist, htgf_portfolio) + their traces,
//                                  every column name seen in the table, the verdict counts and a timestamp
//   data/funnel.sample.json        the funnel at the same moment, so snapshot pages never contradict themselves
// The full table (~650 rows with long breakdowns) is too big to ship in the app bundle, so only those rows are kept.
// While flow 20 is not published (404) it changes nothing and says so (exit 0).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const LEADS_URL = process.env.N8N_LEADS_URL || "https://floaters.app.n8n.cloud/webhook/htgf-leads";
const FUNNEL_URL = process.env.N8N_FUNNEL_URL || "https://floaters.app.n8n.cloud/webhook/htgf-funnel";
const SHOWN = new Set(["call_now", "watchlist", "htgf_portfolio"]);
const TIMEOUT_MS = 60_000; // a script may wait longer than a page (the pages give up after 8 s)

async function get(url) {
  const started = Date.now();
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  const text = await res.text();
  return { status: res.status, text, bytes: Buffer.byteLength(text), ms: Date.now() - started };
}

const leadsRes = await get(LEADS_URL).catch((err) => ({ status: 0, error: err.message }));
if (leadsRes.status === 404) {
  console.log(`No change: flow 20 "Leads for the screen" is not published (404 from ${LEADS_URL}).`);
  console.log("Publish it in n8n (project HTGF, flow qd840KXqIoUEnbxl), then run this script again.");
  process.exit(0);
}
if (leadsRes.status !== 200) {
  console.error(`No change: flow 20 answered ${leadsRes.status || leadsRes.error}.`);
  process.exit(1);
}
const data = JSON.parse(leadsRes.text);
if (!Array.isArray(data.leads) || !data.leads.length) {
  console.error("No change: flow 20 answered without leads.");
  process.exit(1);
}

const funnelRes = await get(FUNNEL_URL).catch((err) => ({ status: 0, error: err.message }));
const funnel = funnelRes.status === 200 ? JSON.parse(funnelRes.text) : null;

const live = data.leads.filter((r) => !String(r.verdict || "").startsWith("merged_into:"));
const columns = [...new Set(data.leads.flatMap((r) => Object.keys(r)))].sort();
const byVerdict = {};
for (const r of live) byVerdict[r.verdict || "not classified"] = (byVerdict[r.verdict || "not classified"] || 0) + 1;
const rows = live.filter((r) => SHOWN.has(r.verdict));
const traceIds = new Set(rows.flatMap((r) => String(r.trace_ids || "").split(",").map((s) => s.trim()).filter(Boolean)));
const traces = (data.traces || []).filter((t) => traceIds.has(t.trace_id));
const asOf = data.as_of || new Date().toISOString();

const snapshot = {
  as_of: asOf,
  snapshot_note: `Real rows of the n8n Leads table from flow 20, written by scripts/refresh-leads-snapshot.mjs at ${new Date().toISOString()}. Only the rows the screen shows (verdict call_now, watchlist, htgf_portfolio) and their traces. Used by lib/n8n.js getLeads() when n8n does not answer.`,
  table: { total_rows: data.leads.length, live: live.length, by_verdict: byVerdict, columns },
  leads: rows,
  traces,
};
const out = path.join(ROOT, "data/leads.live-snapshot.json");
const before = JSON.parse(readFileSync(out, "utf8"));
writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`);
if (funnel?.stages) {
  writeFileSync(path.join(ROOT, "data/funnel.sample.json"), `${JSON.stringify({ ...funnel, snapshot_note: `Snapshot of flow 44, written by scripts/refresh-leads-snapshot.mjs at ${new Date().toISOString()}, same minute as data/leads.live-snapshot.json. Used by /api/funnel when n8n does not answer within 8 s.` }, null, 2)}\n`);
}

const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;
console.log(`Flow 20: ${data.leads.length} rows, ${(data.traces || []).length} traces, ${mb(leadsRes.bytes)} in ${leadsRes.ms} ms.`);
console.log(`Snapshot: ${rows.length} rows (call_now ${byVerdict.call_now || 0}, watchlist ${byVerdict.watchlist || 0}, htgf_portfolio ${byVerdict.htgf_portfolio || 0}), ${traces.length} traces, ${columns.length} columns, as of ${asOf} (was ${before.as_of}).`);
console.log(funnel?.stages ? `Funnel: call_now ${funnel.leads?.call_now} (same minute), data/funnel.sample.json rewritten.` : `Funnel: not rewritten (flow 44 answered ${funnelRes.status || funnelRes.error}).`);
if (funnel?.leads?.call_now !== undefined && funnel.leads.call_now !== (byVerdict.call_now || 0)) {
  console.log(`Note: flow 44 counts ${funnel.leads.call_now} call_now, flow 20 ${byVerdict.call_now || 0}. A run was writing in between; run the script again.`);
}
// English everywhere: translate whatever new German text the shown leads brought (lib/ai/translate.js, only missing texts).
try {
  execFileSync(process.execPath, [path.join(ROOT, "scripts/translate-leads.mjs")], { stdio: "inherit", cwd: ROOT });
} catch (err) {
  console.warn(`Translation did not finish (${err.message}); the pages translate the rest on demand.`);
}
console.log("Next: node scripts/field-coverage.mjs");
