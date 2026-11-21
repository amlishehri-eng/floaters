// Outreach (working prototype): a short first email from an HTGF investment manager to the founders, built only from the
// lead's evidence, plus "Mark as contacted". gpt-5-mini through lib/ai/openai.js; without the model, a template in code
// filled from the same fields (mocked: true). Contacts are kept in data/outreach.local.json (gitignored).
// Server only (node:fs).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { openaiOff, structured } from "@/lib/ai/openai";
import { LABELS } from "@/lib/screen/criteria";

const MODEL = "gpt-5-mini";
// A draft is a click, not a page load (the sheet says "Drafting…"), so it may take longer than the 8 s page rule.
const TIMEOUT_MS = 20_000;
const CONTACT_FILE = path.join(process.cwd(), "data", "outreach.local.json");
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const text = (v) => (typeof v === "string" ? v.trim() : "");
const arr = (v) => (Array.isArray(v) ? v : []);

/** Every string inside the lead (columns, breakdowns, evidence), for finding an email or a LinkedIn link. */
function strings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (value && typeof value === "object") for (const v of Object.values(value)) strings(v, out);
  return out;
}

export function emailOf(lead) {
  const found = strings(lead).flatMap((s) => s.match(EMAIL) || []);
  // Skip example and no-reply addresses; prefer the company's own domain.
  const host = text(lead.website).replace(/^https?:\/\/(www\.)?/, "").split("/")[0].toLowerCase();
  const ok = [...new Set(found.map((e) => e.toLowerCase()))].filter((e) => !/example\.|noreply|no-reply|sentry|wixpress/.test(e));
  return ok.find((e) => host && e.endsWith(`@${host}`)) || ok[0] || null;
}

export function linkedinOf(lead) {
  const urls = strings(lead).flatMap((s) => s.match(/https?:\/\/[^\s"'<>)\]]*linkedin\.com\/(?:company|in)\/[^\s"'<>)\]]+/gi) || []);
  return urls.find((u) => /\/company\//.test(u)) || urls[0] || null;
}

/** The strongest fit criterion with its fact, for the one concrete reason in the email. */
export function strongestCriterion(lead) {
  const rows = arr(lead.fit_criteria).filter((c) => c.known !== false && !c.unsupported && Number(c.max) > 0 && c.key !== "germany");
  const best = rows.sort((a, b) => b.points / b.max - a.points / a.max)[0];
  if (!best) return null;
  const quote = arr(best.evidence).map((e) => text(e.quote)).find((q) => q.length > 12) || "";
  return { label: LABELS[best.key] || best.key, why: text(best.why), quote };
}

// Write to the founders (and managing directors), not to mentors or pilot customers named in the sources.
const FOUNDER = /found|ceo|cto|coo|managing|geschäftsführ|gründer|owner|inhaber/i;
function context(lead) {
  const named = arr(lead.people).filter((p) => p?.name);
  const founders = named.filter((p) => FOUNDER.test(p.role || ""));
  const people = founders.length ? founders : named.filter((p) => !/mentor|customer|advisor|professor/i.test(p.role || ""));
  return {
    company: lead.name || lead.id,
    city: lead.city || "",
    what: text(lead.what),
    founders: people.map((p) => ({ name: p.name, role: p.role || "" })),
    strongest: strongestCriterion(lead),
    website: text(lead.website) || null,
  };
}

const SYSTEM = (lang, sender) => `You write a short first email from an investment manager at HTGF (High-Tech Gründerfonds, Germany's seed investor) to the founders of a young deep-tech company.
Use ONLY the facts given in the input. Never invent facts, numbers, customers, funding or praise. No hype, no exclamation marks, no buzzwords.
Keep the status of facts exact: a patent that is filed or pending is not granted; a pilot is not a customer contract.
Structure: start with "Hello <first names>," in English or "Hallo <Vornamen>," in German (only the founders given), else "Hello," / "Guten Tag,". One sentence on what they build. One concrete reason it is interesting, taken from "strongest" (say the fact plainly). The ask: a 20-minute intro call in the next two weeks. Sign off with: ${sender.name}${sender.title ? `, ${sender.title}` : ""}, HTGF.
Under 120 words in the body. Language: ${lang === "de" ? "German, formal (Sie)" : "English"}. Subject under 70 characters, no clickbait.`;

const SCHEMA = { type: "object", additionalProperties: false, required: ["subject", "body"], properties: { subject: { type: "string" }, body: { type: "string" } } };

function sender() {
  return { name: process.env.OUTREACH_SENDER_NAME || "Your name", title: process.env.OUTREACH_SENDER_TITLE || "Investment Manager" };
}

/** The template fallback, from the same fields. */
export function templateDraft(lead, lang = "en") {
  const c = context(lead);
  const s = sender();
  const first = c.founders.map((p) => p.name.split(/\s+/)[0]).slice(0, 2);
  const what = c.what.replace(/\.$/, "");
  const reason = c.strongest ? (c.strongest.why.replace(/\.$/, "") || c.strongest.label) : "";
  if (lang === "de") {
    return {
      subject: `${c.company} und HTGF: kurzes Kennenlernen?`,
      body: [`${first.length ? `Hallo ${first.join(" und ")}` : "Hallo"},`, "", what ? `ich bin auf ${c.company} gestoßen: ${what}.` : `ich bin auf ${c.company} gestoßen.`, reason ? `Besonders interessant finde ich: ${reason}.` : "", "", "Hätten Sie in den nächsten zwei Wochen Zeit für ein 20-minütiges Kennenlernen?", "", "Viele Grüße", `${s.name}, ${s.title}, HTGF`].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n"),
    };
  }
  return {
    subject: `${c.company} and HTGF: a short intro call?`,
    body: [`${first.length ? `Hello ${first.join(" and ")}` : "Hello"},`, "", what ? `I came across ${c.company}: ${what}.` : `I came across ${c.company}.`, reason ? `What stands out to me: ${reason}.` : "", "", "Would you have 20 minutes for an intro call in the next two weeks?", "", "Best regards,", `${s.name}, ${s.title}, HTGF`].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n"),
  };
}

/** { to_name, to_email, subject, body, linkedin, mocked?, error? } */
export async function draftOutreach(lead, lang = "en", { forceFail = false } = {}) {
  const c = context(lead);
  const base = { to_name: c.founders.length ? c.founders.map((p) => p.name).slice(0, 3).join(", ") : `the ${c.company} team`, to_email: emailOf(lead), linkedin: linkedinOf(lead), language: lang };
  try {
    if (forceFail) throw new Error("model call forced to fail (test)");
    if (openaiOff()) throw new Error("OpenAI is off (USE_MOCKS or no OPENAI_API_KEY)");
    const call = structured({ model: MODEL, system: SYSTEM(lang, sender()), input: JSON.stringify(c), schema: SCHEMA, name: "outreach", effort: "minimal" });
    const timer = new Promise((_, reject) => setTimeout(() => reject(new Error(`the draft took longer than ${TIMEOUT_MS / 1000} s`)), TIMEOUT_MS));
    const { data } = await Promise.race([call, timer]);
    if (!text(data.subject) || !text(data.body)) throw new Error("the model returned an empty draft");
    return { ...base, subject: text(data.subject), body: text(data.body) };
  } catch (err) {
    console.warn("[outreach] template draft instead of the model:", err.message);
    return { ...base, ...templateDraft(lead, lang), mocked: true, error: err.message };
  }
}

// ---- Contacted -----------------------------------------------------------------------------------------------------
export async function readContacts() {
  try {
    const list = JSON.parse(await readFile(CONTACT_FILE, "utf8"));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** lead_key -> latest { lead_key, at, channel } */
export async function contactedMap() {
  const map = new Map();
  for (const c of await readContacts()) if (c?.lead_key && (!map.has(c.lead_key) || c.at > map.get(c.lead_key).at)) map.set(c.lead_key, c);
  return map;
}

export async function markContacted({ lead_key, channel }) {
  const entry = { lead_key, at: new Date().toISOString(), channel };
  const list = await readContacts();
  list.push(entry);
  await mkdir(path.dirname(CONTACT_FILE), { recursive: true });
  await writeFile(CONTACT_FILE, `${JSON.stringify(list, null, 2)}\n`);
  return entry;
}
