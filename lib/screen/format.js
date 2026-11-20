// Small formatting helpers shared by the Founders First pages. Pure functions, no I/O.

const TZ = "Europe/Berlin";
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];

export const isNum = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
export const int = (v) => (isNum(v) ? Math.round(Number(v)).toLocaleString("en-US") : "");

/** 7 -> "seven", 42 -> "42". capital: "Seven". */
export function words(n, capital = false) {
  const w = Number.isInteger(n) && n >= 0 && n <= 20 ? WORDS[n] : int(n);
  return capital ? w.charAt(0).toUpperCase() + w.slice(1) : w;
}

function valid(iso) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t) : null;
}

/** "20 November" (Berlin time). */
export function dayMonth(iso) {
  const d = valid(iso);
  return d ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: TZ }).format(d) : "";
}

/** "20 November 2026". */
export function longDate(iso) {
  const d = valid(iso);
  return d ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(d) : "";
}

/** "20 November, 23:05" (Berlin time). */
export function dayTime(iso) {
  const d = valid(iso);
  if (!d) return "";
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).format(d);
  return `${dayMonth(iso)}, ${time}`;
}

/** "Mar 2025". */
export function monthYear(iso) {
  const d = valid(iso);
  return d ? new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: TZ }).format(d) : "";
}

export function usd(v, digits = 2) {
  if (!isNum(v)) return "";
  const n = Number(v);
  const d = n > 0 && n < 0.01 ? 3 : digits;
  return `$${n.toFixed(d)}`;
}

export const capitalise = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "");

export function host(url) {
  return String(url || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

export function clip(text, max = 180) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).replace(/\s+\S*$/, "")}…` : s;
}

/**
 * The one data-source hint every page shows, same wording everywhere:
 * "Live from n8n, as of 21 November, 00:13." / "Snapshot from 21 November, 00:13, n8n not reachable."
 * (USE_MOCKS: "Snapshot from …, offline mode.")
 */
export function sourceHint({ mocked, error, asOf }) {
  const when = dayTime(asOf);
  if (!mocked) return when ? `Live from n8n, as of ${when}.` : "Live from n8n.";
  const base = when ? `Snapshot from ${when}` : "Snapshot";
  return error ? `${base}, n8n not reachable.` : `${base}, offline mode.`;
}
