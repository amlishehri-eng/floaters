#!/usr/bin/env node
// Contrast audit: opens every page in a headless browser and checks every visible text against the background it
// actually sits on (parents' background colours composited up to the page). Fails below 4.5:1, or 3:1 for text 24px
// and up. Prints page, selector, both colours and the ratio. Exit 1 on any failure.
//   node scripts/contrast-audit.mjs                 # against http://localhost:4000
//   AUDIT_URL=http://localhost:4100 node scripts/contrast-audit.mjs
// Playwright is a devDependency for this check only. Browser: Playwright's own, else a cached Chromium, else Chrome.
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const BASE = (process.env.AUDIT_URL || process.env.DEMO_URL || "http://localhost:4000").replace(/\/$/, "");

function browserPaths() {
  const out = [];
  try { out.push(chromium.executablePath()); } catch {}
  const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
  try {
    for (const d of readdirSync(cache).sort().reverse()) {
      if (d.startsWith("chromium_headless_shell-")) out.push(path.join(cache, d, "chrome-headless-shell-mac-arm64/chrome-headless-shell"));
      if (d.startsWith("chromium-")) out.push(path.join(cache, d, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"));
    }
  } catch {}
  out.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
  return out.filter((p) => p && existsSync(p));
}

async function launch() {
  const errors = [];
  for (const executablePath of browserPaths()) {
    try { return await chromium.launch({ executablePath, headless: true }); } catch (err) { errors.push(`${executablePath}: ${err.message.split("\n")[0]}`); }
  }
  throw new Error(`no browser could start:\n${errors.join("\n")}`);
}

// Runs inside the page: every visible element with its own text, its colour, the composited background, the ratio.
function auditInPage() {
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const lum = ({ r, g, b }) => [r, g, b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = ({ r, g, b }) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
  // The background behind an element: its own and its parents' colours, composited from the page up.
  const background = (el) => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    for (const l of layers.reverse()) bg = over(l, bg);
    return bg;
  };
  const selector = (el) => {
    const parts = [];
    for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) {
      const cls = [...e.classList].slice(0, 2).join(".");
      parts.unshift(`${e.tagName.toLowerCase()}${cls ? `.${cls}` : ""}`);
    }
    return parts.join(" > ");
  };
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    if (["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH", "OPTION"].includes(el.tagName)) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
    if (!own) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1 || cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
    if (el.closest("[hidden]")) continue;
    const fg = parse(cs.color);
    if (!fg || fg.a === 0) continue;
    const bg = background(el);
    const shown = fg.a < 1 ? over(fg, bg) : fg;
    const size = parseFloat(cs.fontSize);
    const min = size >= 24 ? 3 : 4.5;
    const value = ratio(shown, bg);
    out.push({ text: own.slice(0, 50), selector: selector(el), fg: hex(shown), bg: hex(bg), ratio: Math.round(value * 100) / 100, min, size });
  }
  return out;
}

const PAGES = [
  { name: "home", path: "/" },
  { name: "call list", path: "/proof/live", lead: true },
  { name: "funnel", path: "/proof/funnel" },
  { name: "filtered", path: "/proof/funnel/filtered" },
  { name: "labs", path: "/proof/labs" },
  { name: "candidates", path: "/proof/candidates", states: true },
  { name: "company page", path: "/proof/company/liquid-mirror" },
  { name: "method", path: "/proof/methodology" },
];

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let failures = 0;
let checked = 0;
for (const p of PAGES) {
  let url = BASE + p.path;
  if (p.lead) {
    const leads = await fetch(`${BASE}/api/leads`).then((r) => r.json()).catch(() => ({ leads: [] }));
    const first = (leads.leads || []).find((l) => l.verdict === "call_now");
    if (first) url += `?lead=${encodeURIComponent(first.id)}`;
  }
  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  const runs = [{ state: "", results: await page.evaluate(auditInPage) }];
  if (p.states) {
    // Hover and keyboard focus on the first card of each kind.
    for (const sel of [".po-tile--matched", "a.po-tile:not(.po-tile--matched)"]) {
      const card = await page.$(sel);
      if (!card) continue;
      await card.hover();
      runs.push({ state: `hover ${sel}`, results: await page.evaluate(auditInPage) });
      await card.focus();
      runs.push({ state: `focus ${sel}`, results: await page.evaluate(auditInPage) });
    }
  }
  const bad = new Map();
  for (const run of runs) {
    checked += run.results.length;
    for (const r of run.results) if (r.ratio < r.min) bad.set(`${r.selector}|${r.fg}|${r.bg}`, { ...r, state: run.state });
  }
  failures += bad.size;
  console.log(`${bad.size ? "FAIL" : "PASS"}  ${p.name.padEnd(13)} ${p.path}  ${runs[0].results.length} texts${runs.length > 1 ? `, ${runs.length - 1} hover/focus states` : ""}${bad.size ? `, ${bad.size} under the minimum` : ""}`);
  for (const r of bad.values()) console.log(`      ${r.ratio.toFixed(2)} < ${r.min}  ${r.fg} on ${r.bg}  ${r.size}px  ${r.selector}  "${r.text}"${r.state ? `  (${r.state})` : ""}`);
}
await browser.close();
console.log(`\n${checked} texts checked on ${PAGES.length} pages, ${failures} failure${failures === 1 ? "" : "s"}`);
process.exit(failures ? 1 : 0);
