#!/usr/bin/env node
// Translate every visible German text of the leads the screen shows into English (lib/ai/translate.js, gpt-5-mini,
// one call per lead), into data/translations.json. Leads: past the HTGF gates (scored, or call_now / watchlist /
// needs_enrichment), every call-now lead and every candidate (flow 42 votes). Already translated texts are skipped.
//   node scripts/translate-leads.mjs              # reads OPENAI_API_KEY from .env.local
//   node scripts/translate-leads.mjs --dry-run    # counts only, no model calls
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
process.chdir(ROOT);
let envLines = [];
try {
  envLines = readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n");
} catch {
  envLines = [];
}
for (const line of envLines) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { loadCache, missing, saveCache, translateRow, TRANSLATE_MODEL } = await import("../lib/ai/translate.js");

const LEADS_URL = process.env.N8N_LEADS_URL || "https://floaters.app.n8n.cloud/webhook/htgf-leads";
const FEEDBACK_URL = process.env.N8N_FEEDBACK_URL || "https://floaters.app.n8n.cloud/webhook/htgf-feedback";
const CONCURRENCY = 6;
const dry = process.argv.includes("--dry-run");

/** The leads the site shows from a flow 20 payload (past the gates, call now, candidates). */
export function shownRows(data, candidates) {
  const live = (data.leads || []).filter((r) => r.lead_key && !String(r.verdict || "").startsWith("merged_into:"));
  return live.filter((r) => Number(r.score_version) === 2 || ["call_now", "watchlist", "needs_enrichment"].includes(r.verdict) || candidates.has(r.lead_key));
}

const res = await fetch(LEADS_URL, { signal: AbortSignal.timeout(60_000) });
if (!res.ok) {
  console.log(`No translation: flow 20 answered ${res.status}.`);
  process.exit(0);
}
const data = await res.json();
const votes = await fetch(FEEDBACK_URL, { signal: AbortSignal.timeout(15_000) }).then((r) => r.json()).catch(() => ({ votes: [] }));
const candidates = new Set((votes.votes || []).filter((v) => v.vote === "up").map((v) => v.lead_key));
const shown = shownRows(data, candidates);
const todo = shown.filter((r) => missing(r).length);
const texts = todo.reduce((n, r) => n + missing(r).length, 0);
console.log(`${shown.length} leads shown on the site, ${todo.length} with German text still untranslated (${texts} texts).`);
if (dry || !todo.length) process.exit(0);

loadCache();
let done = 0;
let count = 0;
let usd = 0;
let failed = 0;
const queue = [...todo];
async function worker() {
  while (queue.length) {
    const row = queue.shift();
    try {
      const r = await translateRow(row, { timeoutMs: 90_000 });
      count += r.count;
      usd += r.usd;
    } catch (err) {
      failed += 1;
      console.warn(`  ${row.lead_key}: ${err.message}`);
    }
    done += 1;
    if (done % 20 === 0) {
      saveCache();
      console.log(`  ${done}/${todo.length} leads, ${count} texts, $${usd.toFixed(3)}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
saveCache();
console.log(`Done: ${done - failed} leads, ${count} texts translated by ${TRANSLATE_MODEL} for $${usd.toFixed(3)}; ${failed} failed (run again to retry).`);
