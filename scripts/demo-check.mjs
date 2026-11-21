#!/usr/bin/env node
// Demo check: hits the running app and prints pass/fail, status, time and `mocked` per page and route.
// Plain node (>= 20), no dependencies. Writes nothing: /api/feedback only gets invalid input (expects 400).
//
//   node scripts/demo-check.mjs                     # against http://localhost:4000
//   node scripts/demo-check.mjs --no-links          # skip the link checks (nav, buttons, deep links, evidence URLs)
//   DEMO_URL=https://<app>.vercel.app node scripts/demo-check.mjs
//
// Mock mode (what the demo looks like with dead wifi): stop the dev server, start it with
//   USE_MOCKS=true npm run dev
// (or set USE_MOCKS=true in .env.local and restart), then run this script again: every API row should say mocked: true.
//
// Render the briefing fallback once the live data is good (needs USE_MOCKS=false, ELEVENLABS_API_KEY and
// ELEVENLABS_VOICE_ID in .env.local, flow "20 Leads for the screen" published):
//   node scripts/demo-check.mjs --render-briefing-sample
// It saves data/briefing.sample.json (en + de script) and data/briefing.sample.mp3 (en audio) from /api/briefing.
import { writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = (process.env.DEMO_URL || "http://localhost:4000").replace(/\/$/, "");
const TIMEOUT_MS = 30_000;

const CHECKS = [
  { name: "home", path: "/", page: true },
  { name: "call list", path: "/proof/live", page: true },
  { name: "funnel page", path: "/proof/funnel", page: true },
  { name: "labs page", path: "/proof/labs", page: true },
  { name: "method page", path: "/proof/methodology", page: true },
  { name: "candidates page", path: "/proof/candidates", page: true },
  { name: "company page", path: "/proof/company/eversyn", page: true },
  { name: "funnel dive (?stage=)", path: "/proof/funnel?stage=scored", page: true },
  { name: "search demo (old)", path: "/proof/search", page: true },
  { name: "extras (labs + backtest)", path: "/api/extras", expect: (j) => Array.isArray(j.labs) && j.labs.length > 0 && Boolean(j.backtest), note: (j) => `${j.labs?.length ?? 0} labs, backtest ${j.backtest?.run_at ?? "none"}` },
  { name: "leads", path: "/api/leads", expect: (j) => Array.isArray(j.leads) && j.leads.length > 0, note: (j) => `${j.leads?.length ?? 0} leads` },
  { name: "funnel", path: "/api/funnel", expect: (j) => Array.isArray(j.stages), note: (j) => funnelNote(j) },
  { name: "briefing json", path: "/api/briefing?format=json", expect: (j) => typeof j.script === "string" && j.script.length > 0, note: (j) => `${j.source}, ${j.leads?.length ?? 0} leads, ${j.words} words ~${j.est_seconds}s` },
  { name: "briefing audio", path: "/api/briefing?format=audio", audio: true },
  {
    name: "feedback (invalid input)",
    path: "/api/feedback",
    method: "POST",
    body: { lead_key: "", vote: "maybe" },
    status: 400,
    expect: (j) => typeof j.error === "string",
    note: (j) => j.error,
  },
  // /api/voice has no GET health path: an empty text must come back as a clear 400 (no ElevenLabs call).
  { name: "voice tts (invalid input)", path: "/api/voice/tts", method: "POST", body: { text: "" }, status: 400, expect: (j) => typeof j.error === "string", note: (j) => j.error },
];

function funnelNote(j) {
  const count = (k) => j.stages?.find((s) => s.key === k)?.count ?? "?";
  return `${count("traces_in")} traces → ${count("leads")} leads → ${count("call_now")} call now`;
}

async function run(check) {
  const started = Date.now();
  const row = { name: check.name, path: check.path, ok: false, status: "-", ms: 0, mocked: "-", note: "" };
  try {
    const res = await fetch(BASE + check.path, {
      method: check.method || "GET",
      headers: check.body ? { "Content-Type": "application/json" } : {},
      body: check.body ? JSON.stringify(check.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    row.status = res.status;
    const type = res.headers.get("content-type") || "";
    const wanted = check.status || 200;

    if (check.page) {
      const html = await res.text();
      row.ok = res.status === wanted && type.includes("text/html") && html.length > 500;
      row.note = `${Math.round(html.length / 1024)} KB html`;
    } else if (check.audio) {
      if (type.includes("audio/mpeg")) {
        const bytes = (await res.arrayBuffer()).byteLength;
        row.mocked = res.headers.get("x-mocked") === "true";
        row.ok = res.status === wanted && bytes > 1000;
        row.note = `${Math.round(bytes / 1024)} KB mp3, ${res.headers.get("x-briefing-source") || "?"}, cache ${res.headers.get("x-cache") || "-"}`;
      } else {
        // No audio anywhere: the route sends the script so the screen can use speechSynthesis.
        const j = await res.json();
        row.mocked = j.mocked ?? "-";
        row.ok = res.status === wanted && typeof j.script === "string";
        row.note = `no mp3, script for speechSynthesis (${j.error || "no error"})`;
      }
    } else {
      const j = type.includes("application/json") ? await res.json() : {};
      row.mocked = check.status ? "-" : (j.mocked ?? false);
      row.ok = res.status === wanted && (!check.expect || check.expect(j));
      row.note = check.note ? check.note(j) : "";
      if (j.error && !check.status) row.note += `${row.note ? "; " : ""}error: ${j.error}`;
      if (j.n8n_error) row.note += `; n8n: ${j.n8n_error}`;
    }
  } catch (err) {
    row.note = err.name === "TimeoutError" ? `no answer within ${TIMEOUT_MS / 1000} s` : err.message;
  }
  row.ms = Date.now() - started;
  return row;
}


// ---- Link checks: every page's nav and buttons, deep links, radar vs call list, real URLs in the lead details ----
const PAGES = [
  { path: "/", nav: null },
  { path: "/proof/live", nav: "/proof/live" },
  { path: "/proof/funnel", nav: "/proof/funnel" },
  { path: "/proof/labs", nav: "/proof/labs" },
  { path: "/proof/methodology", nav: "/proof/methodology" },
  { path: "/proof/candidates", nav: "/proof/candidates" },
];
const NAV = ["/proof/live", "/proof/funnel", "/proof/labs", "/proof/candidates", "/proof/methodology"];
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const hrefs = (html) => [...html.matchAll(/<a\b[^>]*?href="([^"]*)"[^>]*>/g)].map((m) => ({ href: decode(m[1]), tag: m[0] }));
const getText = async (p) => {
  const res = await fetch(BASE + p, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  return { status: res.status, text: await res.text() };
};

async function linkChecks() {
  const rows = [];
  const add = (name, path, ok, note = "", mocked = "-") => rows.push({ name, path, ok, status: ok ? "ok" : "bad", ms: 0, mocked, note });
  const leadsRes = await fetch(`${BASE}/api/leads`, { signal: AbortSignal.timeout(TIMEOUT_MS) }).then((r) => r.json());
  const callNow = (leadsRes.leads || []).filter((l) => l.verdict === "call_now");
  const top = [...callNow].sort((a, b) => (b.priority ?? -1) - (a.priority ?? -1))[0];
  const internal = new Set();
  const external = new Set();

  for (const page of PAGES) {
    const started = Date.now();
    const { status, text } = await getText(page.path);
    const links = hrefs(text);
    const navHrefs = links.filter((l) => l.tag.includes("ff-nav__link")).map((l) => l.href);
    const current = links.filter((l) => l.tag.includes('aria-current="page"')).map((l) => l.href);
    const brand = links.some((l) => l.tag.includes("ff-nav__brand") && l.href === "/");
    const empty = links.filter((l) => !l.href || /undefined|null|NaN/.test(l.href));
    const hint = /Live from n8n, as of|Snapshot from [^<]*?, (n8n not reachable|offline mode)/.test(text);
    for (const l of links) (l.href.startsWith("/") ? internal : /^https?:\/\//.test(l.href) ? external : null)?.add(l.href);
    const navOk = brand && NAV.every((h) => navHrefs.includes(h)) && (page.nav ? current.length === 1 && current[0] === page.nav : current.length === 0);
    rows.push({
      name: `links ${page.path}`, path: page.path, ok: status === 200 && navOk && empty.length === 0 && hint,
      status, ms: Date.now() - started, mocked: "-",
      note: `${links.length} links, nav ${navOk ? "ok" : "WRONG"}, ${empty.length} empty/undefined href, source hint ${hint ? "shown" : "MISSING"}`,
    });
    if (page.path === "/") {
      const need = ["/proof/live", "/proof/funnel", "/proof/methodology", ...(top ? [`/proof/live?lead=${encodeURIComponent(top.id)}`] : [])];
      const missing = need.filter((h) => !links.some((l) => l.href === h));
      add("home buttons", "/", missing.length === 0, missing.length ? `missing ${missing.join(", ")}` : `See the call list, See how it filters, Read the method, Open the lead (${top?.name})`);
      const stars = (text.match(/class="ho-star"/g) || []).length;
      const big = text.match(/>(\d+)<\/span><span>worth a call today/);
      add("home radar = call list", "/", stars === callNow.length && Number(big?.[1]) === callNow.length, `${stars} radar points, "${big?.[1]} worth a call", ${callNow.length} call_now leads`, leadsRes.mocked);
    }
    if (page.path === "/proof/live") {
      const rowsShown = (text.match(/class="cl-row"/g) || []).length;
      const intro = text.match(/<p>([A-Z][a-z]+) teams? worth a call/);
      add("call list = call_now", page.path, rowsShown === callNow.length, `${rowsShown} rows, intro "${intro?.[1]}", ${callNow.length} call_now leads`, leadsRes.mocked);
    }
  }

  // Old addresses redirect to Candidates.
  for (const old of ["/proof", "/proof/portfolio"]) {
    const res = await fetch(BASE + old, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    add(`redirect ${old}`, old, [307, 308].includes(res.status) && (res.headers.get("location") || "").endsWith("/proof/candidates"), `${res.status} -> ${res.headers.get("location")}`);
  }

  // Candidates: every card links to a company page that opens; flow 42's GET lists the votes.
  const cand = await getText("/proof/candidates");
  const cards = [...new Set([...cand.text.matchAll(/href="(\/proof\/company\/[^"]+)"/g)].map((m) => decode(m[1])))];
  const cardFails = [];
  for (const h of cards) {
    const { status, text } = await getText(h);
    if (status !== 200 || text.includes("isn’t in the leads table") || !/Visit the website|No website found yet/.test(text)) cardFails.push(h);
  }
  add("candidate cards open company pages", "/proof/candidates", cardFails.length === 0, cardFails.length ? cardFails.join(", ") : `${cards.length} cards, each opens its company page`);
  const votes = await fetch(process.env.N8N_FEEDBACK_URL || "https://floaters.app.n8n.cloud/webhook/htgf-feedback", { signal: AbortSignal.timeout(8000) }).then((r) => r.json()).catch((e) => ({ error: e.message }));
  add("feedback GET (flow 42)", "GET /webhook/htgf-feedback", Array.isArray(votes.votes), votes.error || `${votes.votes?.length ?? 0} votes`);
  const unknown = await getText("/proof/company/no-such-lead");
  add("company page, unknown key", "/proof/company/no-such-lead", unknown.text.includes("isn’t in the leads table"), "clear message with a link back");

  // Funnel dive: lower stages go down, every dive's groups add up, every company row opens its page.
  const fun = await getText("/proof/funnel?stage=scored");
  const nums = [...fun.text.matchAll(/aria-label="([^"]+?), ([\d,]+)\. (?:Show|Close) the ([\d,]+) that stopped/g)].map((m) => ({ stage: decode(m[1]), n: Number(m[2].replace(/,/g, "")), drop: Number(m[3].replace(/,/g, "")) }));
  const down = nums.every((x, i) => i === 0 || x.n <= nums[i - 1].n) && nums.every((x, i) => !nums[i + 1] || nums[i + 1].n + x.drop === x.n);
  add("funnel stages add up", "/proof/funnel", nums.length >= 4 && down, nums.map((x) => `${x.n} (-${x.drop})`).join(" > ") || "no dive buttons (snapshot leads?)");
  const groupNs = [...fun.text.matchAll(/class="fd-group__n">(\d+)</g)].map((m) => Number(m[1]));
  const scored = nums.find((x) => x.stage.startsWith("Scored"));
  add("dive ?stage=scored groups add up", "/proof/funnel?stage=scored", Boolean(scored) && groupNs.reduce((t, n) => t + n, 0) === scored.drop, `${groupNs.join(" + ")} = ${groupNs.reduce((t, n) => t + n, 0)}, drop-outs ${scored?.drop}`);
  const diveLinks = [...new Set([...fun.text.slice(fun.text.indexOf('id="funnel-dive"')).matchAll(/href="(\/proof\/company\/[^"]+)"/g)].map((m) => decode(m[1])))];
  const badDive = [];
  for (const h of diveLinks) {
    const { status, text } = await getText(h);
    if (status !== 200 || text.includes("isn’t in the leads table")) badDive.push(h);
  }
  add("dive rows open company pages", "/proof/funnel?stage=scored", diveLinks.length > 0 && badDive.length === 0, badDive.length ? badDive.slice(0, 3).join(", ") : `${diveLinks.length} company links, all open`);

  // Deep link per lead: /proof/live?lead=<key> opens exactly that lead; collect its evidence, press and website links.
  let wrong = [];
  for (const l of callNow) {
    const { text } = await getText(`/proof/live?lead=${encodeURIComponent(l.id)}`);
    const h2 = decode(text.match(/<article aria-label="Lead detail"[\s\S]*?<h2>([^<]*)<\/h2>/)?.[1] || "");
    if (h2 !== l.name) wrong.push(`${l.id} -> "${h2}"`);
    for (const a of hrefs(text.slice(text.indexOf('aria-label="Lead detail"')))) {
      if (!a.href || /undefined|null|NaN/.test(a.href)) wrong.push(`${l.id}: empty href`);
      else if (/^https?:\/\//.test(a.href)) external.add(a.href);
    }
  }
  add("deep link ?lead= per lead", "/proof/live?lead=…", wrong.length === 0, wrong.length ? wrong.slice(0, 3).join("; ") : `${callNow.length} of ${callNow.length} open the right lead`);

  // Internal links answer 200; external ones are well-formed URLs (reachability noted, sites may block bots).
  const badInternal = [];
  for (const h of internal) {
    const res = await fetch(BASE + h, { signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => null);
    if (!res || res.status !== 200) badInternal.push(`${h} ${res?.status ?? "no answer"}`);
  }
  add("internal links answer 200", "(all pages)", badInternal.length === 0, badInternal.length ? badInternal.join(", ") : `${internal.size} distinct internal links`);
  const malformed = [...external].filter((u) => { try { new URL(u); return false; } catch { return true; } });
  const unreachable = [];
  const list = [...external];
  for (let i = 0; i < list.length; i += 8) {
    await Promise.all(list.slice(i, i + 8).map(async (u) => {
      const res = await fetch(u, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0 (link check)" } }).catch((e) => ({ status: e.name }));
      if (!(res.status < 400 || res.status === 403 || res.status === 429)) unreachable.push(`${u} ${res.status}`);
    }));
  }
  add("external links are real URLs", "(evidence, press, sites, papers)", malformed.length === 0, `${external.size} distinct, ${malformed.length} malformed, ${unreachable.length} not reachable now${unreachable.length ? `: ${unreachable.slice(0, 2).join(", ")}` : ""}`);
  return { rows, unreachable };
}

function printTable(rows) {
  const cols = [
    ["", (r) => (r.ok ? "PASS" : "FAIL")],
    ["check", (r) => r.name],
    ["path", (r) => r.path],
    ["status", (r) => String(r.status)],
    ["ms", (r) => String(r.ms)],
    ["mocked", (r) => String(r.mocked)],
    ["note", (r) => String(r.note).slice(0, 110)],
  ];
  const widths = cols.map(([h, f]) => Math.max(h.length, ...rows.map((r) => f(r).length)));
  const line = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join("  ").trimEnd();
  console.log(line(cols.map(([h]) => h)));
  console.log(line(widths.map((w) => "-".repeat(w))));
  for (const r of rows) console.log(line(cols.map(([, f]) => f(r))));
}

async function renderBriefingSample() {
  const get = async (q) => {
    const res = await fetch(`${BASE}/api/briefing?${q}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`/api/briefing?${q} returned ${res.status}`);
    return res;
  };
  const byLang = {};
  for (const lang of ["en", "de"]) {
    const j = await (await get(`lang=${lang}&format=json`)).json();
    if (j.source !== "live" || j.mocked) throw new Error(`briefing (${lang}) is not live: ${j.error || j.source}. Fix that first (USE_MOCKS=false, flow 20 published).`);
    const { audio_cached, audio_url, mocked, source, ...keep } = j;
    byLang[lang] = keep;
  }
  const audio = await get("lang=en&format=audio");
  if (!audio.headers.get("content-type")?.includes("audio/mpeg") || audio.headers.get("x-mocked") === "true") {
    throw new Error("ElevenLabs did not render the briefing (check ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID)");
  }
  const dir = path.join(process.cwd(), "data");
  const sample = {
    note: "Fallback for /api/briefing (n8n or ElevenLabs down, or USE_MOCKS=true). Rendered by scripts/demo-check.mjs --render-briefing-sample; audio of the en script: data/briefing.sample.mp3.",
    as_of: byLang.en.as_of,
    rendered_at: new Date().toISOString(),
    audio_lang: "en",
    by_lang: byLang,
  };
  await writeFile(path.join(dir, "briefing.sample.mp3"), Buffer.from(await audio.arrayBuffer()));
  await writeFile(path.join(dir, "briefing.sample.json"), JSON.stringify(sample, null, 1) + "\n");
  console.log(`Saved data/briefing.sample.json and data/briefing.sample.mp3 (${byLang.en.words} words, as of ${sample.as_of}).`);
}

if (process.argv.includes("--render-briefing-sample")) {
  try {
    await renderBriefingSample();
  } catch (err) {
    console.error(`Not saved: ${err.message}`);
    process.exit(1);
  }
} else {
  console.log(`Demo check against ${BASE}\n`);
  const rows = [];
  for (const check of CHECKS) rows.push(await run(check));
  let unreachable = [];
  if (!process.argv.includes("--no-links")) {
    const links = await linkChecks().catch((err) => ({ rows: [{ name: "link checks", path: "-", ok: false, status: "-", ms: 0, mocked: "-", note: err.message }], unreachable: [] }));
    rows.push(...links.rows);
    unreachable = links.unreachable;
  }
  printTable(rows);
  if (unreachable.length) console.log(`\nExternal links that did not answer now (not a failure; check by hand):\n${unreachable.map((u) => `  ${u}`).join("\n")}`);
  const passed = rows.filter((r) => r.ok).length;
  const mocked = rows.filter((r) => r.mocked === true).length;
  const slowest = rows.reduce((a, b) => (b.ms > a.ms ? b : a));
  console.log(`\n${passed}/${rows.length} passed, ${mocked} served mock data, slowest ${slowest.name} ${slowest.ms} ms`);
  process.exit(passed === rows.length ? 0 : 1);
}
