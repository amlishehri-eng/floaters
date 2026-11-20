import OpenAI from "openai";
// Relative imports so scripts/test-brain.mjs can load the pipeline with plain node.
import { mocksEnabled } from "../mocks.js";

export const MODEL_FAST = process.env.OPENAI_MODEL_FAST || "gpt-5.4-mini";
export const MODEL_SMART = process.env.OPENAI_MODEL || "gpt-5.5";

// USD per 1M tokens (standard tier, short context) and per web search call.
// Checked on developers.openai.com/api/docs/pricing on 2026-11-20.
// Web search: $10 / 1k calls, search content tokens billed at model rates (already in usage tokens).
export const PRICES = {
  "gpt-5.5": { input: 5.0, cached: 0.5, output: 30.0 },
  "gpt-5.4": { input: 2.5, cached: 0.25, output: 15.0 },
  "gpt-5.4-mini": { input: 0.75, cached: 0.075, output: 4.5 },
  "gpt-5-mini": { input: 0.25, cached: 0.025, output: 2.0 },
};
export const WEB_SEARCH_PER_CALL = 10 / 1000;

// Unknown model → priced like gpt-5.5 so the cost slide never under-reports.
function priceFor(model) {
  const key = Object.keys(PRICES)
    .sort((a, b) => b.length - a.length)
    .find((k) => model === k || model.startsWith(`${k}-`));
  return PRICES[key] || PRICES["gpt-5.5"];
}

export function costOf(usage) {
  const p = priceFor(usage.model);
  const cached = usage.cached_tokens || 0;
  const fresh = Math.max(0, usage.input_tokens - cached);
  const tokens = (fresh * p.input + cached * p.cached + usage.output_tokens * p.output) / 1e6;
  return tokens + (usage.web_search_calls || 0) * WEB_SEARCH_PER_CALL;
}

// True when the brain should serve data/leads.sample.json instead of calling OpenAI.
export function openaiOff() {
  return mocksEnabled() || !process.env.OPENAI_API_KEY;
}

let client;
function getClient() {
  client ??= new OpenAI({ timeout: 120_000, maxRetries: 2 });
  return client;
}

/**
 * One structured-output call via the Responses API.
 * Returns { data, usage } where usage = { model, input_tokens, cached_tokens, output_tokens, web_search_calls }.
 * Throws on refusal, truncation or invalid JSON: callers decide what to do with the error.
 */
export async function structured({ model, system, input, schema, name, webSearch = false, effort }) {
  const response = await getClient().responses.create({
    model,
    instructions: system,
    input,
    text: { format: { type: "json_schema", name, schema, strict: true } },
    ...(webSearch ? { tools: [{ type: "web_search", user_location: { type: "approximate", country: "DE" } }] } : {}),
    ...(effort ? { reasoning: { effort } } : {}),
  });

  const usage = {
    model,
    input_tokens: response.usage?.input_tokens || 0,
    cached_tokens: response.usage?.input_tokens_details?.cached_tokens || 0,
    output_tokens: response.usage?.output_tokens || 0,
    web_search_calls: response.output.filter((item) => item.type === "web_search_call").length,
  };

  const refusal = response.output
    .flatMap((item) => (item.type === "message" ? item.content : []))
    .find((c) => c.type === "refusal");
  if (refusal) throw Object.assign(new Error(`model refused: ${refusal.refusal}`), { usage });
  if (response.status === "incomplete") {
    throw Object.assign(new Error(`response incomplete: ${response.incomplete_details?.reason}`), { usage });
  }

  try {
    return { data: JSON.parse(response.output_text), usage };
  } catch {
    throw Object.assign(new Error("model returned invalid JSON"), { usage });
  }
}
