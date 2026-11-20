// Criteria, weights and labels the screen shows. Weights must match the n8n scoring (flow 13 v8 = scoring v3 for fit,
// lib/ai/prompts/brain.js for team, flow 13 timing). Pure data, safe to import in client components.

// Scoring v3 (n8n/scoring-v3-plan.md, flow 13 v8): fit counts only these four, each scaled to its v3 weight.
// Germany, sector, stage and no funding are hard checks (in `eligibility`), not points. Keep in sync with FIT_W in flow 13.
export const FIT_V3 = [
  { key: "tech_depth", weight: 40, from: ["tech_depth"] },
  { key: "corporate_pull", weight: 25, from: ["corporate_pull"] },
  { key: "research_or_patent", weight: 20, from: ["research_or_patent", "patent_before_company"] },
  { key: "capital_need", weight: 15, from: ["capital_need"] },
];

export const TEAM = [
  { key: "technical_founder", weight: 25 },
  { key: "complementary_roles", weight: 15 },
  { key: "worked_together", weight: 15 },
  { key: "deep_research", weight: 10 },
  { key: "earlier_startup", weight: 10 },
  { key: "industry_scar", weight: 10 },
  { key: "concrete_pitch_language", weight: 10 },
  { key: "spin_off_chair", weight: 5 },
];

export const TIMING = [
  { key: "momentum", weight: 35 },
  { key: "exist_runway", weight: 25 },
  { key: "phd_ending", weight: 25 },
  { key: "comeback", weight: 15 },
];

export const LABELS = {
  tech_depth: "Tech depth",
  corporate_pull: "Corporate pull",
  research_or_patent: "Research or patent",
  patent_before_company: "Patent before company",
  capital_need: "Capital need",
  sector: "Sector",
  stage: "Stage",
  no_funding: "No funding",
  germany: "Germany",
  technical_founder: "Technical founder",
  complementary_roles: "Complementary roles",
  worked_together: "Worked together",
  deep_research: "Deep research",
  earlier_startup: "Earlier startup",
  industry_scar: "Industry scar",
  concrete_pitch_language: "Concrete pitch",
  spin_off_chair: "Spin-off chair",
  momentum: "Momentum",
  exist_runway: "EXIST runway",
  phd_ending: "PhD ending",
  comeback: "Comeback",
};

export const label = (key) => LABELS[key] || String(key || "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

// HTGF check rows, in the reference's order. Keys are the `eligibility` keys flow 13 writes.
export const CHECKS = [
  { key: "germany", label: "Germany" },
  { key: "stage", label: "Under 3 years" },
  { key: "sector", label: "HTGF sector" },
  { key: "no_funding", label: "No VC round" },
  { key: "legal_entity", label: "Legal entity" },
];

export const VERDICTS = [
  { key: "needs_enrichment", label: "Needs more evidence", color: "#6e6e73" },
  { key: "not_high_tech", label: "Not high-tech", color: "#a1a1a6" },
  { key: "not_a_startup", label: "Not a startup", color: "#a1a1a6" },
  { key: "out_of_scope", label: "Out of scope", color: "#a1a1a6" },
  { key: "too_late", label: "Too late", color: "#a1a1a6" },
  { key: "watchlist", label: "Watchlist", color: "#33d1ff" },
  { key: "htgf_portfolio", label: "Already HTGF portfolio", color: "#f5f5f7" },
  { key: "call_now", label: "Call now", color: "#ff5b3a" },
  { key: "not_a_lead", label: "Not a lead", color: "#6e6e73" },
  { key: "unscored", label: "Unscored", color: "#6e6e73" },
];

export const FUNDING = {
  none: "No funding named",
  angels: "Business angels",
  grants: "Grants",
  seeking: "Seeking investors",
  pre_seed: "Pre-seed",
  seed_vc: "VC-led seed",
  series_a_plus: "Series A or later",
  unknown: "Funding unknown",
};

export const STAGE0_RULES = {
  too_old: "Older than 3 years",
  unreadable: "Unreadable",
  agency: "Agency",
  duplicate: "Duplicate",
  not_germany: "Not in Germany",
  ecosystem_org: "Ecosystem organisation",
  investor: "Investor",
  event_only: "Event only",
  assignment: "Assignment",
  established_company: "Established company",
};
