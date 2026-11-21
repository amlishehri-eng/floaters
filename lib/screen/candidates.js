// Candidates (/proof/candidates): leads marked "Good lead" on the call list, as cards. Pure functions.
import { dayMonthShort, isNum } from "./format";

const BRING_PREFIX = "brought back from the funnel: ";

export const companyHref = (key) => `/proof/company/${encodeURIComponent(key)}`;

export function candidateCards(candidates) {
  return (candidates || []).map(({ lead, voted_at, reason }) => ({
    key: lead.id,
    href: companyHref(lead.id),
    name: lead.name || lead.id,
    sector: String(lead.sector || "Sector not known"),
    city: lead.city || "City not known",
    fit: isNum(lead.fit_score) ? `${Math.round(Number(lead.fit_score))} fit` : "Fit not known",
    voted: voted_at ? `Marked good lead, ${dayMonthShort(voted_at)}` : "Marked good lead",
    callNow: lead.verdict === "call_now",
    // Brought back from the filtered page: the vote reason says what it was filtered for.
    brought: String(reason || "").startsWith(BRING_PREFIX) ? `Brought back, filtered for: ${String(reason).slice(BRING_PREFIX.length)}` : "",
  }));
}
