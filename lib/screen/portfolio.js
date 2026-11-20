// Portfolio (/proof): the example tiles from data/portfolio-examples.json, matched against leads the engine marked
// htgf_portfolio (by name or website host). Pure functions.
import { host, monthYear } from "./format";

const LEGAL = /\b(gmbh|ug|ag|se|kg|haftungsbeschränkt|co|inc|ltd)\b\.?/g;
export const nameRoot = (s) => String(s || "").toLowerCase().replace(/\(.*?\)/g, " ").replace(LEGAL, " ").replace(/[^a-z0-9äöüß:]+/g, " ").trim();
const siteHost = (url) => host(url).split("/")[0].toLowerCase();

export function portfolioPage({ companies, leads }) {
  const portfolioLeads = (leads || []).filter((l) => l.verdict === "htgf_portfolio");
  const names = new Set(portfolioLeads.map((l) => nameRoot(l.name)).filter(Boolean));
  const hosts = new Set(portfolioLeads.map((l) => siteHost(l.website)).filter(Boolean));
  const tiles = (companies || []).map((c) => {
    const matched = names.has(nameRoot(c.name)) || (c.website && hosts.has(siteHost(c.website)));
    return {
      key: c.slug || c.name,
      name: c.name,
      sector: String(c.sector || "Sector not known").replace(/\s*&\s*/g, " and "),
      city: String(c.location || "City not known").split(" · ")[0],
      amount: c.round?.amount || "Undisclosed",
      stage: c.round?.stage || "Round not known",
      date: monthYear(c.round?.date) || "date not known",
      source: c.round?.source || "",
      matched,
    };
  });
  // Matched tiles first, as in the reference (the black tile leads the grid).
  tiles.sort((a, b) => Number(b.matched) - Number(a.matched));
  return { count: portfolioLeads.length, tiles };
}
