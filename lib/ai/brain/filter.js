// Step 2: Noise filter on the combined evidence of one lead (fast model).
import { MODEL_FAST } from "../openai.js";
import { FILTER_SYSTEM } from "../prompts/brain.js";
import { LABELS } from "./config.js";

const FILTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["label", "label_reason"],
  properties: {
    label: { type: "string", enum: LABELS },
    label_reason: { type: "string" },
  },
};

export async function labelLead(lead, evidence, llm) {
  const { data, usage } = await llm({
    step: "filter",
    model: MODEL_FAST,
    effort: "low",
    system: FILTER_SYSTEM,
    input: evidence,
    schema: FILTER_SCHEMA,
    name: "noise_filter",
    lead,
  });
  if (!LABELS.includes(data.label)) throw new Error(`unknown label "${data.label}"`);
  return { label: data.label, label_reason: data.label_reason, usage };
}
