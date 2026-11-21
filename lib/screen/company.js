// Company page (/proof/company/[key]): everything about one lead, grouped in spec rows. Builds on leadDetail()
// from the call list (rings, checks, funding, fit and team rows with dropdowns, deep checks, days ahead) and adds
// what only the full profile shows. Pure functions; every empty value gets its honest empty state.
import { leadDetail } from "./call-list";
import { VERDICTS } from "./criteria";
import { clip, dayMonth, decodeEntities, host, int, isNum, longDate } from "./format";

const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const text = (v) => (typeof v === "string" ? v.trim() : "");
const isUrl = (u) => /^https?:\/\//.test(text(u));

function allUrls(value, re) {
  const found = new Set();
  const walk = (v) => {
    if (typeof v === "string") for (const m of v.match(/https?:\/\/[^\s"'<>)\]]+/g) || []) if (re.test(m)) found.add(m.replace(/[.,;]+$/, ""));
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(value);
  return [...found];
}

const why = (crit, key) => text(obj(obj(crit)[key]).why);

function about(lead) {
  const fit = obj(lead.fit_breakdown);
  // The longest good description the lead has (Leads has no separate description column; these are the prose ones).
  const candidates = [text(lead.what), text(lead.score_reason), text(lead.fit_reason)].filter(Boolean).map(decodeEntities);
  const description = candidates.sort((a, b) => b.length - a.length)[0] || "No description in the traces yet.";
  const rows = [
    { label: "What they build", value: text(lead.what) && text(lead.what) !== description ? text(lead.what) : "" },
    { label: "Technology", value: why(fit, "tech_depth") },
    { label: "Customers and corporate pull", value: why(fit, "corporate_pull") },
    { label: "Research or patent", value: why(fit, "research_or_patent") || why(fit, "patent_before_company") },
    { label: "Stage", value: text(lead.stage) && lead.stage !== "unknown" ? `${lead.stage}${why(fit, "stage") ? `. ${why(fit, "stage")}` : ""}` : "" },
  ].filter((r) => r.value);
  return { description, rows };
}

function founders(lead) {
  const linkedin = allUrls(lead, /linkedin\.com\/in\//i);
  const people = arr(lead.people).filter((p) => p && p.name).map((p) => {
    const slug = p.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/).filter((w) => w.length > 2);
    const link = linkedin.find((u) => slug.some((w) => u.toLowerCase().includes(w))) || "";
    return { name: p.name, role: String(p.role || "").replace(/_/g, " "), linkedin: link };
  });
  const team = obj(lead.team_breakdown);
  const background = [why(team, "technical_founder"), why(team, "earlier_startup"), why(team, "industry_scar"), why(team, "deep_research")]
    .filter((w) => w && !/^unknown/i.test(w));
  return { people, background: [...new Set(background)].slice(0, 3).map((b) => clip(b, 240)), linkedin };
}

function ageAndRegister(lead) {
  const age = obj(lead.age_check);
  const reg = obj(age.register);
  const rows = [];
  if (age.founded_year) rows.push({ label: "Founded", value: `${age.founded_year}${age.founded_quote ? `: “${clip(age.founded_quote, 160)}”` : ""}`, url: isUrl(age.founded_url) ? age.founded_url : "" });
  if (reg.number || lead.register_id) {
    rows.push({
      label: "Register entry",
      value: [reg.court, reg.number || lead.register_id, lead.legal_form, (reg.registered_date || lead.registered_at) && `registered ${longDate(reg.registered_date || lead.registered_at)}`].filter(Boolean).join(", "),
      url: isUrl(reg.url) ? reg.url : "",
    });
  } else rows.push({ label: "Register entry", value: lead.registry_checked_at ? "Not in the register yet." : "Not checked yet.", url: "" });
  const rounds = arr(age.rounds).filter((r) => r && (r.type || r.lead_investor));
  rows.push({
    label: "Rounds found",
    value: rounds.length
      ? rounds.map((r) => [r.type, r.lead_investor && `led by ${r.lead_investor}`, isNum(r.amount_eur_m) && `€${r.amount_eur_m}M`, r.date && longDate(r.date)].filter(Boolean).join(", ")).join("; ")
      : age.founded_year ? "None found by the age and funding check." : "Not checked yet.",
    url: rounds.map((r) => r.url).find(isUrl) || "",
  });
  return rows;
}

function capital(lead) {
  const c = obj(lead.capital_need);
  if (!isNum(c.points)) return { value: "Not checked yet.", why: "", url: "" };
  return {
    value: `${c.points} of ${c.max || 15}`,
    why: clip(text(c.why), 300),
    url: arr(c.evidence).map((e) => e?.url).find(isUrl) || "",
  };
}

function traceLinks(lead) {
  const seen = new Set();
  return arr(lead.signals)
    .filter((s) => s && isUrl(s.url) && !seen.has(s.url) && seen.add(s.url))
    .map((s) => ({ url: s.url, label: `${s.kind || "source"}: ${host(s.url).split("/")[0]}`, date: s.happened_at ? longDate(s.happened_at) : "" }));
}

/** The whole company page, or null for an unknown key. */
export function companyPage(lead, { vote = null, labs = [] } = {}) {
  if (!lead) return null;
  const d = leadDetail(lead);
  const verdict = VERDICTS.find((v) => v.key === lead.verdict);
  const allQuotes = decodeEntities(lead.quotes).split("\n").map((q) => q.replace(/^\[[^\]]*\]\s*/, "").trim()).filter((q) => q.length >= 30);
  const lab = arr(labs).find((l) => l.city && lead.city && l.city.toLowerCase() === String(lead.city).toLowerCase());
  const profiles = allUrls(lead, /linkedin\.com\/company\//i).slice(0, 2).map((u) => ({ url: u, label: "LinkedIn" }));
  // The high-tech gate: tech depth at least 60 percent of its maximum (15 of 25 in the n8n rules).
  const tech = d.fitRows.find((r) => r.key === "tech_depth");
  const highTech = !tech || tech.pts === null
    ? { result: "Unknown", ink: "#4f6573", dot: "#8fa6b4", evidence: "tech depth not known" }
    : tech.pts >= 0.6 * tech.max
      ? { result: "Pass", ink: "#1a5276", dot: "#1a5276", evidence: `tech depth ${tech.shown}` }
      : { result: "Fail", ink: "#0d2b3d", dot: "#0d2b3d", evidence: `tech depth ${tech.shown}, the gate needs 60 percent` };
  return {
    ...d,
    highTech,
    verdictLabel: verdict?.label || (lead.verdict ? String(lead.verdict).replace(/_/g, " ") : "Not classified yet"),
    rings: d.rings.slice(0, 2),
    profiles,
    about: about(lead),
    founders: founders(lead),
    ageRows: ageAndRegister(lead),
    capital: capital(lead),
    research: {
      lab: lab ? { name: lab.name, gap: lab.gap_score } : null,
      papers: arr(obj(obj(lead.fit_breakdown).research_or_patent || obj(lead.fit_breakdown).patent_before_company).evidence).map((e) => e?.url).filter(isUrl).slice(0, 3),
    },
    quotes: allQuotes.slice(0, 6),
    // Only the company page says so: quotes that the translation layer turned into English.
    quotesTranslated: (lead.translated_fields || []).some((p) => p === "quotes" || p.endsWith("/quote")),
    traces: traceLinks(lead),
    vote: vote
      ? { text: `${vote.vote === "up" ? "Marked good lead" : "Marked not a fit"}${vote.created_at ? ` on ${dayMonth(vote.created_at)}` : ""}.`, reason: text(vote.reason) }
      : null,
    stats: { sources: int(lead.source_count) || "1", traces: int(lead.trace_count) || String(arr(lead.signals).length) },
  };
}
