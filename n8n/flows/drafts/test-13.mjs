// Offline test of the flow 13 v8 Code node on an export of the Leads table (JSON array of rows). Nothing is written anywhere.
// Usage: node n8n/flows/drafts/test-13.mjs <leads.json> [--list]
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const rows = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const code = fs.readFileSync(path.join(here, "13-classify-v8.js"), "utf8");
const run = new Function("$input", code);
const changed = run({ all: () => rows.map((json) => ({ json })) });
const byKey = new Map(changed.map((i) => [i.json.lead_key, i.json]));
const after = rows.filter((r) => r.lead_key && !String(r.verdict || "").startsWith("merged_into:")).map((r) => ({ ...r, ...(byKey.get(r.lead_key) || {}) }));
const before = new Map(rows.map((r) => [r.lead_key, r]));

const count = (list) => list.reduce((m, r) => ((m[r.verdict] = (m[r.verdict] || 0) + 1), m), {});
const b = count(rows.filter((r) => !String(r.verdict || "").startsWith("merged_into:"))), a = count(after);
console.log("verdict            before  after");
for (const v of [...new Set([...Object.keys(b), ...Object.keys(a)])].sort((x, y) => (a[y] || 0) - (a[x] || 0)))
  console.log(`  ${v.padEnd(18)} ${String(b[v] || 0).padStart(5)} ${String(a[v] || 0).padStart(6)}`);
console.log(`rows changed: ${changed.length} of ${rows.length}`);

const line = (r) => `${String(r.name).slice(0, 30).padEnd(30)} ${String(r.verdict).padEnd(16)} fit ${String(before.get(r.lead_key).fit_score ?? "-").padStart(3)}->${String(r.fit_score).padStart(3)} team ${String(r.team_score_known ?? "-").padStart(3)} prio ${r.priority}`;
console.log("\nCALL NOW:");
for (const r of after.filter((r) => r.verdict === "call_now").sort((x, y) => y.priority - x.priority)) console.log("  " + line(r) + "\n      " + r.verdict_reason.slice(0, 220));
console.log("\nTOP 15 on the screen:");
for (const r of after.sort((x, y) => (y.priority ?? 0) - (x.priority ?? 0)).slice(0, 15)) console.log("  " + line(r));
const was = rows.filter((r) => r.verdict === "call_now").map((r) => r.lead_key);
const lost = was.filter((k) => byKey.has(k) && byKey.get(k).verdict !== "call_now");
console.log("\nwas call now, not any more:", lost.map((k) => `${before.get(k).name} -> ${byKey.get(k).verdict}: ${byKey.get(k).verdict_reason.slice(0, 160)}`));
const newStudents = after.filter((r) => r.verdict === "not_a_startup" && /research or student team/.test(r.verdict_reason));
console.log("\nnew not_a_startup (research or student team):", newStudents.length, newStudents.slice(0, 12).map((r) => r.name));
const germanyFlip = after.filter((r) => before.get(r.lead_key).verdict === "out_of_scope" && r.verdict !== "out_of_scope");
console.log("\nno longer out_of_scope (German base or other):", germanyFlip.map((r) => `${r.name} -> ${r.verdict}`));
if (process.argv.includes("--list")) {
  console.log("\nWATCHLIST (passed the gates, missing a must-have):");
  for (const r of after.filter((r) => r.verdict === "watchlist").sort((x, y) => y.priority - x.priority).slice(0, 25)) console.log("  " + line(r) + "\n      " + r.verdict_reason.slice(0, 200));
}
