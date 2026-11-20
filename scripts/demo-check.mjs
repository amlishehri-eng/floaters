#!/usr/bin/env node
// Demo check: hits the running app and prints pass/fail, status, time and `mocked` per page and route.
// Plain node (>= 20), no dependencies. Writes nothing: /api/feedback only gets invalid input (expects 400).
//
//   node scripts/demo-check.mjs                     # against http://localhost:4000
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
  { name: "portfolio page", path: "/proof", page: true },
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
  printTable(rows);
  const passed = rows.filter((r) => r.ok).length;
  const mocked = rows.filter((r) => r.mocked === true).length;
  const slowest = rows.reduce((a, b) => (b.ms > a.ms ? b : a));
  console.log(`\n${passed}/${rows.length} passed, ${mocked} served mock data, slowest ${slowest.name} ${slowest.ms} ms`);
  process.exit(passed === rows.length ? 0 : 1);
}
