#!/usr/bin/env node
// Unit test for the screen's data functions (lib/n8n.js getLeads/getFunnel/getExtras + lib/screen/*), without a server:
//   node scripts/test-screen.mjs
// Checks, for live n8n, USE_MOCKS=true, a refused connection and a hanging n8n (8 s timeout):
// every page view model is complete and has no "null", "undefined" or "NaN" in any text, and no empty section.
import { register } from "node:module";
import http from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

// Resolve "@/..." and extensionless imports, and load .json files as modules (the app's import style).
register(
  "data:text/javascript," +
    encodeURIComponent(`
      import { existsSync, readFileSync } from "node:fs";
      import { pathToFileURL, fileURLToPath } from "node:url";
      const ROOT = ${JSON.stringify(ROOT)};
      export async function resolve(spec, ctx, next) {
        if (spec === "next/cache") return { url: "data:text/javascript,export const unstable_cache = (fn) => fn; export const revalidateTag = () => {};", shortCircuit: true };
        let s = spec.startsWith("@/") ? ROOT + "/" + spec.slice(2) : spec;
        if (s.startsWith("/") || s.startsWith(".")) {
          const base = s.startsWith("/") ? s : fileURLToPath(new URL(s, ctx.parentURL));
          for (const c of [base, base + ".js", base + "/index.js"]) if (existsSync(c) && !c.endsWith("/")) {
            try { if (readFileSync(c) !== null) return { url: pathToFileURL(c).href, shortCircuit: true }; } catch {}
          }
        }
        return next(spec, ctx);
      }
      export async function load(url, ctx, next) {
        if (url.endsWith(".json")) return { format: "module", source: "export default " + readFileSync(new URL(url), "utf8"), shortCircuit: true };
        if (url.startsWith("file:") && url.endsWith(".js")) return { format: "module", source: readFileSync(new URL(url), "utf8"), shortCircuit: true };
        return next(url, ctx);
      }
    `),
);

const n8n = await import(`${ROOT}/lib/n8n.js`);
const { callList, leadDetail } = await import(`${ROOT}/lib/screen/call-list.js`);
const { funnelPage } = await import(`${ROOT}/lib/screen/funnel.js`);
const { labsPage, backtestView } = await import(`${ROOT}/lib/screen/extras.js`);
const { homePage } = await import(`${ROOT}/lib/screen/home.js`);
const { candidateCards } = await import(`${ROOT}/lib/screen/candidates.js`);
const { companyPage } = await import(`${ROOT}/lib/screen/company.js`);
const { honestFunnel } = await import(`${ROOT}/lib/screen/funnel.js`);
const { filteredPage, nearMiss, ageOf } = await import(`${ROOT}/lib/screen/filtered.js`);
const coords = JSON.parse(readFileSync(`${ROOT}/data/city-coords.json`, "utf8"));

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed += 1;
};

// Every string in a view model: no null/undefined/NaN shown as text, no non-finite numbers.
function badValues(value, where = "") {
  const bad = [];
  const walk = (v, p) => {
    if (typeof v === "string" && /\b(null|undefined|NaN)\b|\[object Object\]/.test(v)) bad.push(`${p}: ${v.slice(0, 80)}`);
    else if (typeof v === "number" && !Number.isFinite(v)) bad.push(`${p}: ${v}`);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${p}.${k}`);
  };
  walk(value, where);
  return bad;
}

async function pages(label) {
  const started = Date.now();
  const [leads, funnel, extras] = await Promise.all([n8n.getLeads(), n8n.getFunnel(), n8n.getExtras()]);
  const ms = Date.now() - started;
  const views = {
    callList: callList({ leads: leads.leads, asOf: leads.as_of, funnel, mocked: leads.mocked }),
    funnel: funnelPage(funnel, { mocked: funnel.mocked }),
    labs: labsPage(extras.labs),
    method: backtestView(extras.backtest),
    home: homePage({ funnel, leads: leads.leads, extras, coords }),
    candidates: candidateCards(leads.leads.slice(0, 3).map((lead, i) => ({ lead, voted_at: `2026-11-2${i}T10:00:00Z`, reason: "" }))),
    company: companyPage(leads.leads[0], { vote: { vote: "up", created_at: "2026-11-21T00:00:00Z", reason: "test" }, labs: extras.labs }),
    honest: honestFunnel(funnel, leads, { mocked: funnel.mocked }),
  };
  const flags = `leads ${leads.mocked ? "snapshot" : "live"}, funnel ${funnel.mocked ? "snapshot" : "live"}, extras ${extras.mocked ? "snapshot" : "live"}, ${ms} ms`;
  check(`${label}: data loads`, leads.leads.length > 0 && funnel.stages?.length > 0 && extras.labs?.length > 0, flags);
  check(`${label}: call list has rows and details`, views.callList.rows.length > 0 && views.callList.details.length === views.callList.rows.length, `${views.callList.rows.length} call now`);
  check(`${label}: funnel has 8 stages and verdicts`, views.funnel.stages.length === 8 && views.funnel.verdicts.length > 0 && views.funnel.codeCuts.length > 0);
  check(`${label}: labs has 10 labs`, views.labs.length === 10, `${views.labs.length}`);
  check(`${label}: method backtest table`, Boolean(views.method && views.method.table.length === 4));
  check(`${label}: home radar and top lead`, views.home.stars.length > 0 && Boolean(views.home.top), `${views.home.stars.length} points, ${views.home.skipped} without coordinates`);
  check(`${label}: candidate cards`, views.candidates.length === 3 && views.candidates.every((c) => c.href.startsWith("/proof/company/")));
  check(`${label}: company page`, Boolean(views.company?.name && views.company.fitRows.length && views.company.checks.length), views.company?.name);
  const lower = views.honest.stages.slice(views.honest.lowerFrom ?? 99);
  check(`${label}: honest funnel`, leads.mocked ? Boolean(views.honest.diveNote) : lower.every((s, i) => i === 0 || s.count <= lower[i - 1].count) && lower.every((s, i) => !lower[i + 1] || s.dropped + lower[i + 1].count === s.count), leads.mocked ? "snapshot: dive off" : lower.map((s) => s.count).join(" > "));
  if (!leads.mocked) {
    const f = filteredPage(leads.leads, { stage: "all", asOf: leads.as_of });
    const sums = f.tabs.filter((t) => t.key !== "all").map((t) => {
      const v = filteredPage(leads.leads, { stage: t.key, asOf: leads.as_of });
      return v.reasons.reduce((n, r) => n + r.n, 0) === t.count && v.cards.length === t.count;
    });
    check(`${label}: filtered reasons add up per stage`, sums.every(Boolean) && f.reasons.reduce((n, r) => n + r.n, 0) === f.total, `${f.total} stopped, ${f.reasons.length} reasons`);
    check(`${label}: filtered near misses ≤ 6, each with a rule`, f.near.length <= 6 && f.near.every((c) => c.near?.rule && c.near?.missedBy), `${f.nearAll} match, ${f.near.length} shown: ${f.near.map((c) => c.near.rule.split(",")[0]).join("; ")}`);
    const raw = JSON.stringify(f.cards.map((c) => [c.sentence, c.city, c.stats.map((x) => x.value)]));
    check(`${label}: filtered cards have no raw values`, !/undefined|null|NaN|[{}]|\(\s*"|\($/.test(raw) && !/Deutschland/.test(raw));
  }
  // Near-miss rules on hand-made leads (each rule fires only when it should).
  const asOf = "2026-11-21T00:00:00Z";
  const mk = (o) => ({ id: "t", score_version: 2, ...o });
  check(`${label}: near-miss rules`, [
    nearMiss(mk({ registered_at: "2023-07-01" }), "Older than three years", asOf, 80)?.rule === "age over the limit by 6 months or less",
    nearMiss(mk({ registered_at: "2022-01-01" }), "Older than three years", asOf, 80) === null,
    nearMiss(mk({ verdict_reason: "no_funding (EUR 3.4M disclosed (3M or more))" }), "Raised €3M or more", asOf, 80)?.missedBy === "€3.4M, just over the line.",
    nearMiss(mk({ fit_score: 53 }), "Fit below 55", asOf, 80)?.missedBy === "Fit 53, call now starts at 55.",
    nearMiss(mk({ fit_score: 49 }), "Fit below 55", asOf, 80) === null,
    nearMiss(mk({ fit_score: 66, registered_at: "2020-01-01" }), "Older than three years", asOf, 80)?.missedBy === "Fit 66, stopped by the age check.",
    nearMiss(mk({ fit_score: 40, team_score_known: 85, registered_at: "2020-01-01" }), "Older than three years", asOf, 80)?.rule.startsWith("team score"),
    nearMiss(mk({ fit_score: 66 }), "Team mostly unknown", asOf, 80) === null,
    ageOf({ age_check: { founded_year: 2021 } }, asOf)?.exact === false,
  ].every(Boolean));
  const bad = badValues(views, label);
  check(`${label}: no null, undefined or NaN in any text`, bad.length === 0, bad.slice(0, 3).join(" | "));
  return { leads, funnel, extras, ms };
}

// 1. Live (whatever n8n answers right now; flow 20 is unpublished, so leads come from the snapshot).
delete process.env.USE_MOCKS;
await pages("live");

// 2. USE_MOCKS=true: everything from data/, flagged mocked.
process.env.USE_MOCKS = "true";
const mock = await pages("USE_MOCKS");
check("USE_MOCKS: every source flagged mocked", mock.leads.mocked && mock.funnel.mocked && mock.extras.mocked);
delete process.env.USE_MOCKS;

// 3. n8n refuses the connection: snapshots, with an error that says why.
process.env.N8N_LEADS_URL = process.env.N8N_FUNNEL_URL = process.env.N8N_EXTRAS_URL = "http://127.0.0.1:9/down";
const down = await pages("n8n down");
check("n8n down: errors are reported", Boolean(down.leads.error && down.funnel.error && down.extras.error), down.funnel.error);

// 4. n8n hangs: fallback after ~8 s, not later.
const server = http.createServer(() => {}); // never answers
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/hang`;
process.env.N8N_LEADS_URL = process.env.N8N_FUNNEL_URL = process.env.N8N_EXTRAS_URL = url;
const hang = await pages("n8n hangs");
check("n8n hangs: snapshot after about 8 s", hang.ms >= 7500 && hang.ms < 11000, `${hang.ms} ms`);
server.close();
server.closeAllConnections?.();

// 5. The 60 s cache: a second call within the minute does not go to n8n again.
const t0 = Date.now();
const again = await n8n.getLeads();
check("cache: second call within 60 s is instant", Date.now() - t0 < 50 && again === hang.leads, `${Date.now() - t0} ms`);

// 6. A thin lead (nothing known): honest empty states, no null text.
const thin = leadDetail({ id: "thin", name: "Thin", verdict: "call_now" });
check("thin lead: empty states", thin.days.badge === "Press not checked yet" && thin.funding.coInvestors === "none named" && thin.deep.checked === false && badValues(thin).length === 0, badValues(thin).slice(0, 2).join(" | "));

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
