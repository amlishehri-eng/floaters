#!/usr/bin/env node
// Screenshots of the site for design review: node scripts/screens.mjs <out-dir> [prefix]
// Pages at 1440×900 (full page), plus home at 1280×800 and 1920×1080 (first screen only).
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";

const BASE = (process.env.AUDIT_URL || process.env.DEMO_URL || "http://localhost:4000").replace(/\/$/, "");
const out = process.argv[2] || "screens";
const prefix = process.argv[3] || "";
mkdirSync(out, { recursive: true });

function browserPath() {
  const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
  const list = [];
  try { list.push(chromium.executablePath()); } catch {}
  try { for (const d of readdirSync(cache).sort().reverse()) if (d.startsWith("chromium_headless_shell-")) list.push(path.join(cache, d, "chrome-headless-shell-mac-arm64/chrome-headless-shell")); } catch {}
  list.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
  return list.find((p) => p && existsSync(p));
}

const browser = await chromium.launch({ executablePath: browserPath(), headless: true });
const shots = [
  ["home-1440", "/", 1440, 900, false],
  ["home-1280x800", "/", 1280, 800, false],
  ["home-1920x1080", "/", 1920, 1080, false],
  ["call-list", "/proof/live", 1440, 900, true],
  ["funnel", "/proof/funnel", 1440, 900, true],
  ["filtered", "/proof/funnel/filtered", 1440, 900, true],
  ["labs", "/proof/labs", 1440, 900, true],
  ["candidates", "/proof/candidates", 1440, 900, true],
  ["company", "/proof/company/liquid-mirror", 1440, 900, true],
  ["method", "/proof/methodology", 1440, 900, true],
];
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
for (const [name, p, w, h, full] of shots) {
  if (only && !only.includes(name)) continue;
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 60_000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const file = path.join(out, `${prefix}${name}.png`);
  await page.screenshot({ path: file, fullPage: full });
  console.log(file);
  await page.close();
}
await browser.close();
