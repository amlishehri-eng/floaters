// Step 4: Scoring of vc_backable leads (smart model). The model gives points per criterion,
// code clamps each to the weight in lib/ai/prompts/brain.js and sums them.
import { MODEL_SMART } from "../openai.js";
import { FIT_WEIGHTS, SCORE_SYSTEM, TEAM_WEIGHTS } from "../prompts/brain.js";

const criterion = {
  type: "object",
  additionalProperties: false,
  required: ["points", "why"],
  properties: { points: { type: "integer" }, why: { type: "string" } },
};

const group = (weights) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(weights),
  properties: Object.fromEntries(Object.keys(weights).map((k) => [k, criterion])),
});

const SCORE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["fit", "team", "fit_reason", "team_reason"],
  properties: {
    fit: group(FIT_WEIGHTS),
    team: group(TEAM_WEIGHTS),
    fit_reason: { type: "string" },
    team_reason: { type: "string" },
  },
};

export function sumPoints(points, weights) {
  return Object.entries(weights).reduce((sum, [key, w]) => {
    const p = Math.round(Number(points?.[key]?.points) || 0);
    return sum + Math.min(w.max, Math.max(0, p));
  }, 0);
}

export async function scoreLead(lead, evidence, llm) {
  const { data, usage } = await llm({
    step: "score",
    model: MODEL_SMART,
    system: SCORE_SYSTEM,
    input: evidence,
    schema: SCORE_SCHEMA,
    name: "lead_score",
    lead,
  });
  return {
    fit_score: sumPoints(data.fit, FIT_WEIGHTS),
    team_score: sumPoints(data.team, TEAM_WEIGHTS),
    fit_reason: data.fit_reason,
    team_reason: data.team_reason,
    usage,
  };
}
