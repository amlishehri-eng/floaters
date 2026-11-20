import { FIT_WEIGHTS } from "@/lib/ai/prompts/brain";

const criteria = {
  germany: {
    title: "Geography",
    description: "The gallery gives the Munich area 20 points and other German locations 15. This reflects the sourcing pilot’s Munich focus.",
  },
  sector: {
    title: "Sector fit",
    description: "Examples earn full points when their work falls within digital tech, industrial tech, life sciences, or chemistry.",
  },
  tech_depth: {
    title: "Technical depth",
    description: "Documented research, specialized hardware, and technically distinctive software earn more points. Sparse technical detail earns fewer points.",
  },
  stage: {
    title: "Early-stage fit",
    description: "The gallery gives full points to pre-seed, seed, and early first-equity rounds. A Series A earns zero.",
  },
  no_funding: {
    title: "Funding visibility",
    description: "The scouting rubric prioritizes leads without public institutional funding. Each company in this gallery has announced institutional financing by its snapshot date and earns zero here.",
  },
};

export const fitCriteria = Object.entries(FIT_WEIGHTS).map(([id, { max }]) => ({
  id,
  max,
  ...criteria[id],
}));

export const maxFit = fitCriteria.reduce((total, { max }) => total + max, 0);

export function fitScore(company) {
  return fitCriteria.reduce((total, { id }) => total + company.fit.points[id], 0);
}
