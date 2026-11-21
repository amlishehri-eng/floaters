// English everywhere: the Leads table carries German from the sources (descriptions, roles, quotes, reasons).
// This layer translates every visible free-text field of a lead in ONE gpt-5-mini call (structured output), caches it
// in data/translations.json keyed by lead_key + field path + a hash of the source text (a changed source is translated
// again), and lays the cache over the raw Leads row before the screen reads it. Names, company and court names stay.
// Server only (node:fs). Relative imports so scripts/translate-leads.mjs can load it with plain node.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { costOf, openaiOff, structured } from "./openai.js";

export const TRANSLATE_MODEL = "gpt-5-mini";
const CACHE_FILE = path.join(process.cwd(), "data", "translations.json");
const TIMEOUT_MS = 8_000;

// Visible free-text columns (plain text) and JSON columns whose string leaves under these keys are shown.
const TEXT_FIELDS = ["what", "score_reason", "fit_reason", "team_reason", "verdict_reason", "type_reason", "next_step", "people", "quotes", "funding_evidence", "co_investors", "age_warning", "series_a_notes", "intro_path"];
const JSON_FIELDS = ["fit_breakdown", "team_breakdown", "timing_breakdown", "capital_need", "eligibility", "flight_risk_evidence", "ip_evidence", "grant_bridges", "competitors", "age_check", "anti_signals"];
const TEXT_KEYS = new Set(["why", "quote", "evidence", "claim", "why_it_fits", "why_similar", "founded_quote"]);

// A cheap check so English text is never sent: German function words, umlaut words and typical German nouns.
const GERMAN = /\b(der|die|das|und|mit|für|von|zur|zum|ist|eine?|wir|sich|nicht|auf|im|den|dem|des|bei|durch|als|auch|werden|wird|sind|oder|über|unsere?|wurde|haben|sowie|nach|gegründet|Leitung|Leiter|Gründer(in)?|Mitgründer|Geschäftsführ\w*|Entwicklung|Unternehmen|kaufmännische?|technische[rn]?|Förder\w*|Forschung|Hochschule|Lehrstuhl)\b/gi;
export function looksGerman(text) {
  const t = String(text || "");
  if (t.length < 4) return false;
  // Multi-line fields ("quotes"): German if any line is German.
  if (t.includes("\n")) return t.split("\n").some((line) => looksGerman(line));
  const hits = (t.match(GERMAN) || []).length;
  const umlaut = /[äöüÄÖÜß]/.test(t.replace(/\b[A-ZÄÖÜ][a-zäöüß]+(?:\s[A-ZÄÖÜ][a-zäöüß]+)?\b/g, "")); // umlauts outside capitalised names
  return hits >= 2 || (hits >= 1 && (umlaut || t.length < 80)) || (umlaut && /\b[a-zäöüß]{4,}(ung|keit|heit|lich|isch)\b/.test(t));
}

// Names like "Johannes von Wittke" are not German text; drop capitalised name runs before the second check.
const stripNames = (t) => String(t || "").replace(/\b(?:[A-ZÄÖÜ][\wäöüß.-]+\s+)?(?:von|van|de|zu)\s+[A-ZÄÖÜ][\wäöüß-]+/g, "");
const hash = (text) => createHash("sha1").update(String(text)).digest("hex").slice(0, 12);
const parse = (v) => {
  if (v && typeof v === "object") return v;
  try { return v ? JSON.parse(v) : null; } catch { return null; }
};

/** Every visible text of a raw Leads row as { path: text }. Paths: "what", "fit_breakdown/tech_depth/why", … */
export function visibleTexts(row) {
  const out = {};
  for (const f of TEXT_FIELDS) if (typeof row[f] === "string" && row[f].trim()) out[f] = row[f];
  for (const f of JSON_FIELDS) {
    const walk = (v, p) => {
      if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}/${i}`));
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
        if (typeof x === "string" && TEXT_KEYS.has(k) && x.trim()) out[`${p}/${k}`] = x;
        else if (x && typeof x === "object") walk(x, `${p}/${k}`);
      }
    };
    walk(parse(row[f]), f);
  }
  return out;
}

// ---- Cache ------------------------------------------------------------------------------------------
let memory = null;
let memoryMtime = 0;
const mtime = () => { try { return statSync(CACHE_FILE).mtimeMs; } catch { return 0; } };
// Reloads when the file changed on disk (scripts/translate-leads.mjs ran), so a running server picks it up.
export function loadCache() {
  const m = mtime();
  if (memory && m === memoryMtime) return memory;
  try { memory = JSON.parse(readFileSync(CACHE_FILE, "utf8")); } catch { memory ||= { meta: {}, leads: {} }; }
  memoryMtime = m;
  memory.leads ||= {};
  memory.meta ||= {};
  return memory;
}
export function saveCache() {
  const c = loadCache();
  c.meta.updated_at = new Date().toISOString();
  try {
    mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    writeFileSync(CACHE_FILE, `${JSON.stringify(c, null, 1)}\n`);
    memoryMtime = mtime();
  } catch (err) {
    console.warn("[translate] cache not written (read-only file system?), kept in memory:", err.message); // Vercel
  }
}

/** The German texts of a row that the cache does not hold for their current source. */
export function missing(row) {
  const cached = loadCache().leads[row.lead_key] || {};
  // Also once more when the cached English still reads German (a German quote left inside an English sentence).
  return Object.entries(visibleTexts(row)).filter(([p, t]) => looksGerman(t) && (cached[p]?.h !== hash(t) || (looksGerman(stripNames(cached[p].en)) && !cached[p].retried)));
}

const SYSTEM = `You translate short texts about German startups into plain English for an investor screen.
Rules: translate faithfully, keep meaning and tone, do not add or drop facts. Keep person names, company names, product names,
court names (Amtsgericht ...), register numbers (HRB ...), programme names (EXIST, BMBF, ...), numbers, dates, currencies and URLs exactly.
For "people" texts ("Name (role); ...") keep the names and translate only the roles. Keep line breaks and "[label]" prefixes.
German words or quoted German phrases inside an English sentence must be translated too (keep the quote marks).
If a text is fully English, return it unchanged. Return one item per input id.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: { items: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "en"], properties: { id: { type: "string" }, en: { type: "string" } } } } },
};

/** Translate the missing texts of one row (one model call). Returns { count, usd }. Throws on failure or timeout. */
export async function translateRow(row, { timeoutMs = 60_000 } = {}) {
  const todo = missing(row);
  if (!todo.length) return { count: 0, usd: 0 };
  if (openaiOff()) throw new Error("OpenAI is off (USE_MOCKS or no OPENAI_API_KEY)");
  const ids = todo.map(([p], i) => ({ id: `t${i}`, path: p }));
  const input = JSON.stringify({ company: row.name || row.lead_key, texts: todo.map(([, t], i) => ({ id: `t${i}`, text: t })) });
  const call = structured({ model: TRANSLATE_MODEL, system: SYSTEM, input, schema: SCHEMA, name: "translations", effort: "low" });
  const timer = new Promise((_, reject) => setTimeout(() => reject(new Error(`translation took longer than ${timeoutMs / 1000} s`)), timeoutMs));
  const { data, usage } = await Promise.race([call, timer]);
  const byId = new Map((data.items || []).map((x) => [x.id, x.en]));
  const c = loadCache();
  c.leads[row.lead_key] ||= {};
  let count = 0;
  for (const { id, path: p } of ids) {
    const en = byId.get(id);
    const src = todo.find(([q]) => q === p)[1];
    const again = c.leads[row.lead_key][p]?.h === hash(src);
    if (typeof en === "string" && en.trim()) { c.leads[row.lead_key][p] = { h: hash(src), en, ...(again && { retried: true }) }; count += 1; }
  }
  const usd = costOf(usage);
  c.meta.cost_usd_total = Math.round(((c.meta.cost_usd_total || 0) + usd) * 10000) / 10000;
  c.meta.model = TRANSLATE_MODEL;
  return { count, usd };
}

function setPath(obj, parts, value) {
  let o = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (o == null || typeof o !== "object") return false;
    o = o[/^\d+$/.test(parts[i]) && Array.isArray(o) ? Number(parts[i]) : parts[i]];
  }
  if (o == null || typeof o !== "object") return false;
  o[parts[parts.length - 1]] = value;
  return true;
}

/** The row with every cached translation laid over its fields (only where the source still matches). */
export function applyTranslations(row) {
  const cached = loadCache().leads[row.lead_key];
  if (!cached) return row;
  const texts = visibleTexts(row);
  const out = { ...row };
  const parsed = {};
  const translated = [];
  for (const [p, src] of Object.entries(texts)) {
    const t = cached[p];
    if (!t || t.h !== hash(src)) continue;
    const [field, ...rest] = p.split("/");
    if (!rest.length) out[field] = t.en;
    else {
      parsed[field] ||= structuredClone(parse(row[field]));
      if (!setPath(parsed[field], rest, t.en)) continue;
    }
    translated.push(p);
  }
  Object.assign(out, parsed);
  if (translated.length) out.translated_fields = translated;
  return out;
}

/**
 * Render-time safety net for the few leads a page shows in detail: translate whatever is still German, within 8 s
 * in total. On failure the original text stays and the reason is logged; the page never waits longer.
 */
export async function ensureEnglish(rows) {
  const todo = rows.filter((r) => missing(r).length);
  if (!todo.length || openaiOff()) return;
  const results = await Promise.allSettled(todo.map((r) => translateRow(r, { timeoutMs: TIMEOUT_MS })));
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length < results.length) saveCache();
  if (failed.length) console.warn(`[translate] ${failed.length} lead(s) shown untranslated: ${failed[0].reason?.message}`);
}
