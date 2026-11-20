// Parsing of loose n8n input and name normalization for convergence.

const UMLAUTS = { ä: "ae", ö: "oe", ü: "ue", ß: "ss", æ: "ae", ø: "oe", å: "aa" };

export function foldUmlauts(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[äöüßæøå]/g, (c) => UMLAUTS[c])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// "Dr. Lena Müller" → "lena mueller"
export function normName(s) {
  return foldUmlauts(s)
    .replace(/\b(dr|prof|phd|msc|bsc|mr|mrs|ms)\b\.?/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// "@LMueller", "github.com/lmueller" → "lmueller"
export function normHandle(s) {
  if (!s) return null;
  const h = String(s)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^(www\.)?(github\.com|huggingface\.co)\//, "")
    .replace(/^@/, "")
    .split(/[/?#\s]/)[0];
  return h || null;
}

const LEGAL_SUFFIXES =
  /\b(gmbh|ug|haftungsbeschraenkt|ag|se|kg|ohg|gbr|ev|inc|ltd|llc|corp|co|bv|sas|sarl)\b/g;

// "Gripr GmbH", "GRIPR." → "gripr"
export function normProject(s) {
  return foldUmlauts(s)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(LEGAL_SUFFIXES, " ")
    .replace(/\s+/g, "")
    .trim();
}

export function normCity(s) {
  const c = normName(s);
  return c === "muenchen" ? "munich" : c;
}

export function slug(s) {
  return foldUmlauts(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Levenshtein ratio: 1 = equal, 0 = nothing in common.
export function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

// Accepts an object, a JSON string, or empty. Returns the parsed value or `fallback`.
export function parseJson(value, fallback = null) {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// people as an array (strings or objects) or as a comma/newline string:
// "Lena Müller (@lmueller), Jonas Weber" → [{ name: "Lena Müller", handle: "lmueller" }, { name: "Jonas Weber", handle: null }]
export function parsePeople(people) {
  const parsed = parseJson(people, people);
  const items = Array.isArray(parsed)
    ? parsed
    : String(parsed ?? "")
        .split(/[\n,;]+/)
        .map((s) => s.trim());

  return items
    .map((item) => {
      if (item && typeof item === "object") {
        return { name: item.name || null, handle: normHandle(item.handle) };
      }
      const s = String(item ?? "").trim();
      if (!s) return null;
      const handle = s.match(/@([\w.-]+)/)?.[1] || null;
      const name = s.replace(/\(?@[\w.-]+\)?/g, "").replace(/[()]/g, "").trim() || null;
      return { name: name || handle, handle: normHandle(handle) };
    })
    .filter((p) => p && (p.name || p.handle));
}

export function toBool(v) {
  if (v === true || v === false) return v;
  if (v == null || v === "") return null;
  return String(v).toLowerCase() === "true";
}

export function toNumber(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Any date-ish value → "YYYY-MM-DD", or null.
export function toDay(v) {
  if (!v) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function daysBetween(fromDay, toDayValue) {
  return Math.round((Date.parse(toDayValue) - Date.parse(fromDay)) / 86_400_000);
}

export function mostCommon(values) {
  const counts = new Map();
  for (const v of values) if (v != null && v !== "") counts.set(v, (counts.get(v) || 0) + 1);
  let best = null;
  for (const [v, n] of counts) if (best === null || n > counts.get(best)) best = v;
  return best;
}
