// Outreach: a first email from an HTGF investment manager to the founders, built only from the lead's evidence, plus
// "Mark as contacted". gpt-5.5 through lib/ai/openai.js writes the draft and three subject lines; the cost of every draft
// is logged and returned. Without the model (off, error, timeout, a draft that breaks the rules twice) a template in code
// with the same structure is filled from the same fields (mocked: true, error says why).
// Contacts are kept in data/outreach.local.json (gitignored). Server only (node:fs).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { MODEL_SMART, costOf, openaiOff, structured } from "@/lib/ai/openai";
import { LABELS } from "@/lib/screen/criteria";

const MODEL = MODEL_SMART; // gpt-5.5: the email is the one text a founder reads, so it gets the stronger model
// A draft is a click, not a page load (the dialog says "Drafting…"), so it may take longer than the 8 s page rule.
const TIMEOUT_MS = 45_000;
const CONTACT_FILE = path.join(process.cwd(), "data", "outreach.local.json");
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BANNED = /\b(revolutionary|revolutionise|revolutionize|game[- ]chang\w*|synerg\w*|cutting[- ]edge|disrupt\w*|excited to|thrilled|leverag\w*|groundbreaking|world[- ]class|innovative|bahnbrechend\w*|revolutionär\w*|innovativ\w*|spannend\w*)\b/i;
const MIN_WORDS = 90;
const MAX_WORDS = 140;

const text = (v) => (typeof v === "string" ? v.trim() : "");
const arr = (v) => (Array.isArray(v) ? v : []);
const decode = (s) => text(s).replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const hostOf = (u) => text(u).replace(/^https?:\/\/(www\.)?/, "").split(/[/?#]/)[0].toLowerCase();
export const wordCount = (s) => text(s).split(/\s+/).filter(Boolean).length;

/** Every string inside the lead (columns, breakdowns, evidence), for finding an email or a LinkedIn link. */
function strings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (value && typeof value === "object") for (const v of Object.values(value)) strings(v, out);
  return out;
}

export function emailOf(lead) {
  const found = strings(lead).flatMap((s) => s.match(EMAIL) || []);
  // Skip example and no-reply addresses; prefer the company's own domain.
  const host = hostOf(lead.website);
  const ok = [...new Set(found.map((e) => e.toLowerCase()))].filter((e) => !/example\.|noreply|no-reply|sentry|wixpress/.test(e));
  return ok.find((e) => host && e.endsWith(`@${host}`)) || ok[0] || null;
}

export function linkedinOf(lead) {
  const urls = strings(lead).flatMap((s) => s.match(/https?:\/\/[^\s"'<>)\]]*linkedin\.com\/(?:company|in)\/[^\s"'<>)\]]+/gi) || []);
  return urls.find((u) => /\/company\//.test(u)) || urls[0] || null;
}

// ---- Who to write to -----------------------------------------------------------------------------------------------
// Founders and managing directors, never mentors or pilot customers named in the sources. Three places, in order:
// people with a founder role; the register's managing director (age_check quote); a name that opens the
// technical_founder sentence ("Thomas Rexer co-invented …"). The last two are heuristics on English/German register text.
const FOUNDER = /found|ceo|cto|coo|managing|geschäftsführ|gründer|owner|inhaber/i;
const NAME = "[A-ZÄÖÜ][\\p{L}'-]+(?:\\s+(?:von|van|de|zu)?\\s*[A-ZÄÖÜ][\\p{L}'-]+){1,2}";
const cleanName = (n) => text(n).replace(/,?\s*(PhD|Ph\.D\.|MBA|M\.Sc\.|Dr\.-Ing\.)$/i, "").replace(/^(Dr\.|Prof\.)\s+/g, "").trim();

function founders(lead) {
  const out = [];
  const add = (name, role) => {
    const n = cleanName(name);
    if (n.split(/\s+/).length < 2 || out.some((p) => p.name === n)) return;
    out.push({ name: n, first_name: n.split(/\s+/)[0], role });
  };
  for (const p of arr(lead.people)) if (p?.name && FOUNDER.test(p.role || "")) add(p.name, p.role);
  const register = `${text(lead.age_check?.founded_quote)} ${strings(lead.registry_signals).join(" ")}`;
  for (const m of register.matchAll(new RegExp(`Geschäftsführer(?::in)?:?\\s*(${NAME})`, "gu"))) add(m[1].replace(/\s+•.*$/, ""), "managing director (register)");
  const tech = text(arr(lead.team_criteria).find((c) => c.key === "technical_founder")?.why);
  const m = tech.match(new RegExp(`^(?:Dr\\.\\s+|Prof\\.\\s+)?(${NAME})\\s+(?:co-invented|invented|is|has|was|spent|developed|leads|founded|built)`, "u"));
  if (m) add(m[1], "technical founder");
  return out.slice(0, 3);
}

/** What the team criteria say about one founder (sentences that name them). */
function background(person, lead) {
  const last = person.name.split(/\s+/).pop();
  return arr(lead.team_criteria)
    .filter((c) => c.known !== false && Number(c.points) > 0)
    .map((c) => decode(c.why))
    .filter((w) => w.includes(person.first_name) || w.includes(last))
    .slice(0, 3);
}

const usable = (c) => c && c.known !== false && !c.unsupported && Number(c.max) > 0 && Number(c.points) > 0 && c.key !== "germany";
function criterion(c) {
  const ev = arr(c.evidence);
  return {
    criterion: LABELS[c.key] || c.key,
    why: decode(c.why),
    quotes: ev.map((e) => decode(e.quote)).filter((q) => q.length > 12).slice(0, 2),
    source: ev.map((e) => text(e.url)).find(Boolean) || null,
  };
}

/** The two strongest fit criteria with their facts and quotes, for the one specific observation in the email. */
export function strongestCriteria(lead, n = 2) {
  // capital_need is our own inference, not something they said or showed, so it never counts as a strength here.
  return arr(lead.fit_criteria).filter((c) => usable(c) && c.key !== "capital_need").sort((a, b) => b.points / b.max - a.points / a.max).slice(0, n).map(criterion);
}

const SOURCE_WORDS = { campus: "a university spin-off list", accelerator: "an accelerator or founder competition page", jobs: "a job ad", github: "GitHub", huggingface: "Hugging Face", luma: "an event page", recording: "a pitch recording", website: "their website", podcast: "a podcast" };
const fmtDate = (iso, lang) => {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(lang === "de" ? "de-DE" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });
};

/** Where we came across them and whether the press has written about them yet, as plain facts. */
function whereAndWhen(lead) {
  const first = arr(lead.signals).filter((s) => s.kind !== "website").sort((a, b) => String(a.happened_at).localeCompare(String(b.happened_at)))[0];
  const where = first ? { kind: SOURCE_WORDS[first.kind] || first.kind, host: hostOf(first.url), url: first.url, date: text(first.happened_at).slice(0, 10) || null } : null;
  const press = lead.first_public_at ? { first_press: text(lead.first_public_at).slice(0, 10), press_url: text(lead.first_public_url) || null } : { first_press: null, note: "no editorial press coverage found yet" };
  return { where_found: where, first_seen: text(lead.first_trace_at).slice(0, 10) || null, ...press };
}

/** Two concrete slots next week (Tuesday 10:00, Thursday 15:00, Berlin time), in the email's language. */
export function timeOptions(lang = "en", now = new Date()) {
  const d = new Date(now);
  const toMonday = ((8 - d.getUTCDay()) % 7) || 7;
  const mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + toMonday, 12));
  const day = (offset) => new Date(mon.getTime() + offset * 86_400_000);
  const fmt = (date, hour) => lang === "de"
    ? `${date.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}, ${hour} Uhr`
    : `${date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })} at ${hour}:00`;
  return [fmt(day(1), 10), fmt(day(3), 15)];
}

function sender() {
  return { name: process.env.OUTREACH_SENDER_NAME || "Your name", title: process.env.OUTREACH_SENDER_TITLE || "Investment Manager" };
}

/** Everything the model may use: only facts from the lead, plus the sender and the two time slots. */
export function outreachContext(lead, lang = "en") {
  const people = founders(lead).map((p) => ({ ...p, background: background(p, lead) }));
  const byKey = (k) => arr(lead.fit_criteria).find((c) => c.key === k);
  const research = byKey("research_or_patent");
  const pull = byKey("corporate_pull");
  const fitNotes = [
    lead.funding_status && lead.funding_status !== "unknown" ? `funding so far: ${lead.funding_status}${lead.funding_evidence ? ` (${decode(lead.funding_evidence).slice(0, 220)})` : ""}` : "",
    lead.age_check?.founded_year ? `founded ${lead.age_check.founded_year}` : "",
    usable(byKey("capital_need")) ? `capital need: ${decode(byKey("capital_need").why)}` : "",
    text(lead.next_step) && !/^call this week\.?$/i.test(text(lead.next_step)) ? `our next step: ${decode(lead.next_step)}` : "",
    text(lead.intro_path) ? `possible intro: ${decode(lead.intro_path)}` : "",
  ].filter(Boolean);
  return {
    company: lead.name || lead.id,
    city: lead.city || "",
    website: text(lead.website) || null,
    what: decode(lead.what),
    founders: people,
    strongest: strongestCriteria(lead),
    research_or_patent: usable(research) ? { ...criterion(research), ip: arr(lead.ip_evidence).map((e) => ({ claim: decode(e.claim), url: e.url })).slice(0, 2) } : null,
    corporate_pull: usable(pull) ? criterion(pull) : null,
    ...whereAndWhen(lead),
    htgf_fit_notes: fitNotes,
    time_options: timeOptions(lang),
    sender: sender(),
  };
}

// ---- The prompt ------------------------------------------------------------------------------------------------------
const RULES_EN = `You write a first email from an investment manager at HTGF (High-Tech Gründerfonds) to the founders of a young German deep-tech company. The only goal: the founders want to answer.

FACTS. Use only facts from the input JSON. Never invent customers, partners, numbers, dates, funding or praise. Keep the status of facts exact: a filed or pending patent is not granted, a pilot is not a paying customer, unnamed customers stay unnamed. Never mention scores, verdicts, criteria, "traces", "signals", a call list or a tool.

STRUCTURE, as short paragraphs (no bullets, no headings, no bold):
1. Greeting: "Hi <first names>," with founders[].first_name (at most two, joined with "and"). If founders is empty: "Hi <company> team,".
2. One specific observation that shows you read about their work: a concrete detail from "strongest" or "research_or_patent" (a method, a number, a quoted claim), in your own words. You may say where you came across them (where_found) in the same sentence.
3. Why it matters: one or two sentences on the real market or industrial pull, from corporate_pull and the industries in "what". If no pull is known, say what the technology unlocks for the industries named in "what", without inventing customers.
4. One line on who is writing and why HTGF: the sender's name and role at HTGF; HTGF invests in high-tech startups at the earliest stage in Germany, with a first ticket at seed, capacity to follow on in later rounds, and a network of corporates and research institutes. If htgf_fit_notes say they raised a seed, link it to their next round.
5. The ask: a 20-minute call next week, offering the two time_options exactly as given, or a reply with a time that works for them.
6. Sign-off on its own lines: "Best," then the sender's name, then "<title>, HTGF".

STYLE. Aim for about 110 words in the body and never more than 130, counting greeting and sign-off: every sentence short. Plain, specific, peer to peer, like a person who read their page. At most one compliment, and it must be a fact. No buzzwords (revolutionary, game-changing, synergy, cutting-edge, innovative, disrupt, leverage, excited to, thrilled). No em dashes or en dashes, no exclamation marks, no bullet points.

SUBJECTS. Three subject lines, each under 60 characters, specific to this company (name the technology or a fact), no clickbait, no "Quick question".`;

const RULES_DE = `Du schreibst eine erste E-Mail einer Investment Managerin oder eines Investment Managers des HTGF (High-Tech Gründerfonds) an die Gründerinnen und Gründer eines jungen deutschen Deep-Tech-Unternehmens. Das einzige Ziel: Sie wollen antworten. Schreibe sie direkt auf Deutsch, als natürliche E-Mail mit "Sie", nicht als Übersetzung eines englischen Texts. Die Fakten im Input sind teils englisch: gib sie sinngemäß auf Deutsch wieder.

FAKTEN. Nur Fakten aus dem Input-JSON. Nie Kunden, Partner, Zahlen, Daten, Finanzierung oder Lob erfinden. Status genau halten: ein angemeldetes Patent ist nicht erteilt, ein Pilot ist kein zahlender Kunde, ungenannte Kunden bleiben ungenannt. Nie Scores, Urteile, Kriterien, "Traces", "Signale", eine Anrufliste oder ein Tool erwähnen.

AUFBAU, in kurzen Absätzen (keine Aufzählungen, keine Überschriften):
1. Anrede: "Guten Tag <Vorname Nachname>," mit den vollen Namen aus founders (höchstens zwei, mit "und"), ohne Herr/Frau, weil das Geschlecht nicht bekannt ist. Ohne founders: "Guten Tag an das Team von <company>,".
2. Eine konkrete Beobachtung, die zeigt, dass Sie sich mit der Arbeit befasst haben: ein Detail aus "strongest" oder "research_or_patent" (eine Methode, eine Zahl, eine Aussage), in eigenen Worten. Wo Sie auf das Team gestoßen sind (where_found), darf im selben Satz stehen.
3. Warum das zählt: ein oder zwei Sätze zum echten Markt- oder Industriebedarf, aus corporate_pull und den Branchen in "what". Ohne bekannten Bedarf: was die Technologie für diese Branchen möglich macht, ohne Kunden zu erfinden.
4. Eine Zeile, wer schreibt und warum HTGF: Name und Rolle beim HTGF; der HTGF investiert in Deutschland in der frühesten Phase in High-Tech-Start-ups, mit einem ersten Ticket ab Seed, Kapazität für Folgerunden und einem Netzwerk aus Unternehmen und Forschungseinrichtungen. Wenn htgf_fit_notes eine Seed-Runde nennen, verknüpfen Sie das mit der nächsten Runde.
5. Die Bitte: ein 20-minütiges Gespräch nächste Woche, mit den beiden time_options genau wie angegeben, oder eine Antwort mit einem Termin, der passt.
6. Gruß in eigenen Zeilen: "Viele Grüße", dann der Name, dann "<Titel>, HTGF".

STIL. Etwa 110 Wörter im Text und nie mehr als 130, Anrede und Gruß mitgezählt: jeder Satz kurz. Schlicht, konkret, auf Augenhöhe. Höchstens ein Kompliment, und es muss ein Fakt sein. Keine Floskeln (revolutionär, bahnbrechend, innovativ, Synergie, disruptiv, spannend, "freue mich riesig"). Keine Gedankenstriche, keine Ausrufezeichen, keine Aufzählungszeichen.

BETREFF. Drei Betreffzeilen, jede unter 60 Zeichen, konkret zu diesem Unternehmen (Technologie oder Fakt nennen), kein Clickbait.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subjects", "body"],
  properties: { subjects: { type: "array", items: { type: "string" } }, body: { type: "string" } },
};

/** Mechanical clean-up (dashes, exclamation marks) and the rule check; returns { body, problems }. */
export function checkDraft(body) {
  const clean = text(body)
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/!/g, ".")
    .replace(/^\s*[-•*]\s+/gm, "");
  const problems = [];
  const words = wordCount(clean);
  if (words < MIN_WORDS || words > MAX_WORDS) problems.push(`the body has ${words} words, it must have ${MIN_WORDS} to ${MAX_WORDS}`);
  const banned = clean.match(BANNED);
  if (banned) problems.push(`it uses the word "${banned[0]}"`);
  return { body: clean, problems, words };
}

// ---- Template fallback (same structure, no model) -------------------------------------------------------------------
const lower1 = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const trimDot = (s) => text(s).replace(/[.\s]+$/, "");

export function templateDraft(lead, lang = "en") {
  const c = outreachContext(lead, lang);
  const s = c.sender;
  const [t1, t2] = c.time_options;
  const first = c.founders.slice(0, 2);
  const what = trimDot(c.what).split(/;|\(/)[0].trim();
  const tech = arr(lead.fit_criteria).find((k) => k.key === "tech_depth");
  const quote = [usable(tech) ? criterion(tech) : null, c.research_or_patent, ...c.strongest].flatMap((k) => k?.quotes || []).find((q) => q.length > 20 && q.length < 140);
  const pullQuote = c.corporate_pull?.quotes?.[0];
  const where = c.where_found;
  const seed = c.htgf_fit_notes.some((n) => /seed_vc|seed round|seed/i.test(n));
  if (lang === "de") {
    const greet = first.length ? `Guten Tag ${first.map((p) => p.name).join(" und ")},` : `Guten Tag an das Team von ${c.company},`;
    const p1 = `ich bin ${where ? `über ${where.host} ` : ""}auf ${c.company} gestoßen.${quote ? ` Hängen geblieben ist bei mir Ihre Aussage „${trimDot(quote)}“.` : ""}`;
    const p2 = pullQuote
      ? `Dass Sie schon jetzt schreiben „${trimDot(pullQuote)}“, zeigt mir, dass der Bedarf echt ist.`
      : "Bei einer Technologie wie Ihrer ist der Schritt vom Labor in die Produktion der Punkt, an dem frühes Kapital und die richtigen Industriepartner am meisten bewirken.";
    const p3 = `Ich bin ${s.name}, ${s.title} beim HTGF. Wir investieren in Deutschland in der frühesten Phase in High-Tech-Start-ups, mit einem ersten Ticket ab Seed, Kapazität für Folgerunden und einem Netzwerk aus Unternehmen und Forschungseinrichtungen${seed ? ", auch mit Blick auf Ihre nächste Runde" : ""}.`;
    const p4 = `Hätten Sie nächste Woche 20 Minuten für ein Gespräch? ${t1} oder ${t2} würde bei mir passen, oder Sie nennen mir einen Termin, der Ihnen besser passt.`;
    return {
      subjects: [`${c.company} und der HTGF`, `${c.company}: 20 Minuten nächste Woche?`, `Frage zu ${c.company} aus ${c.city || "Deutschland"}`].map((x) => x.slice(0, 60)),
      body: [greet, p1, p2, p3, p4, `Viele Grüße\n${s.name}\n${s.title}, HTGF`].join("\n\n"),
    };
  }
  const greet = first.length ? `Hi ${first.map((p) => p.first_name).join(" and ")},` : `Hi ${c.company} team,`;
  const p1 = `I came across ${c.company}${where ? ` on ${where.host}` : ""}.${quote ? ` One line stayed with me: "${trimDot(quote)}".` : ` You work on ${lower1(what)}.`}`;
  const p2 = pullQuote
    ? `You describe yourselves as "${trimDot(pullQuote)}", which tells me the demand is real and not only a lab result.`
    : "With a technology like yours, getting from the lab into production is the step where early capital and the right industrial partners matter most.";
  const p3 = `I am ${s.name}, ${s.title} at HTGF. We invest in German high-tech startups at the earliest stage, with a first ticket at seed, capacity to follow on${seed ? " in your next round" : " in later rounds"}, and a network of corporates and research institutes.`;
  const p4 = `Would you have 20 minutes for a call next week? ${t1} or ${t2} works for me, or reply with a time that suits you.`;
  return {
    subjects: [`${c.company} and HTGF`, `${c.company}: 20 minutes next week?`, `A seed conversation with ${c.company}`].map((x) => x.slice(0, 60)),
    body: [greet, p1, p2, p3, p4, `Best,\n${s.name}\n${s.title}, HTGF`].join("\n\n"),
  };
}

/** { to_name, to_email, founders, website, linkedin, subject, subjects, body, words, language, model?, cost_usd?, mocked?, error? } */
export async function draftOutreach(lead, lang = "en", { forceFail = false } = {}) {
  const c = outreachContext(lead, lang);
  const base = {
    to_name: c.founders.length ? c.founders.map((p) => p.name).join(", ") : `the ${c.company} team`,
    founders: c.founders.map((p) => p.name),
    to_email: emailOf(lead),
    linkedin: linkedinOf(lead),
    website: c.website,
    language: lang,
  };
  let cost = 0;
  const started = Date.now();
  try {
    if (forceFail) throw new Error("model call forced to fail (test)");
    if (openaiOff()) throw new Error("OpenAI is off (USE_MOCKS or no OPENAI_API_KEY)");
    const deadline = new Promise((_, reject) => setTimeout(() => reject(new Error(`the draft took longer than ${TIMEOUT_MS / 1000} s`)), TIMEOUT_MS));
    let feedback = "";
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const call = structured({
        model: MODEL,
        system: lang === "de" ? RULES_DE : RULES_EN,
        input: JSON.stringify(c) + feedback,
        schema: SCHEMA,
        name: "outreach",
        effort: "low",
      });
      const { data, usage } = await Promise.race([call, deadline]);
      cost += costOf(usage);
      const subjects = arr(data.subjects).map((x) => text(x).replace(/[—–]/g, ",").replace(/!/g, "")).filter(Boolean).slice(0, 3);
      const checked = checkDraft(data.body);
      if (subjects.length && !checked.problems.length) {
        console.info(`[outreach] ${c.company} (${lang}): ${MODEL}, ${checked.words} words, $${cost.toFixed(4)}, ${((Date.now() - started) / 1000).toFixed(1)} s, attempt ${attempt}`);
        return { ...base, subject: subjects[0], subjects, body: checked.body, words: checked.words, model: MODEL, cost_usd: Number(cost.toFixed(4)) };
      }
      // Second try: hand the draft back with what to fix, so the model edits it instead of starting over.
      const fix = checked.words > MAX_WORDS ? `cut it to about 115 words (remove ${checked.words - 115} words by shortening sentences, keep every paragraph)` : checked.words < MIN_WORDS ? "add one concrete fact so it has about 110 words" : "fix that";
      feedback = `\n\nYour draft:\n${checked.body}\n\nIt broke the rules: ${checked.problems.join("; ") || "no subject lines"}. Return the same email with this fixed: ${fix}.`;
    }
    throw new Error(`the model's drafts broke the rules twice (${feedback.split("It broke the rules: ").pop().split(". Return")[0]})`);
  } catch (err) {
    cost += err.usage ? costOf(err.usage) : 0;
    console.warn(`[outreach] template draft instead of the model (${c.company}, ${lang}): ${err.message}`);
    const t = templateDraft(lead, lang);
    return { ...base, subject: t.subjects[0], subjects: t.subjects, body: t.body, words: wordCount(t.body), mocked: true, error: err.message, ...(cost ? { cost_usd: Number(cost.toFixed(4)) } : {}) };
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
