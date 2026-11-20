// Step 1: Extract projects, people and quotes from one trace (fast model).
import { MODEL_FAST } from "../openai.js";
import { EXTRACT_SYSTEM } from "../prompts/brain.js";
import { MAX_TRACE_CHARS, QUOTE_KINDS, ROLES, SECTORS, STAGES } from "./config.js";
import { parsePeople } from "./normalize.js";

const str = { type: "string" };
const strOrNull = { type: ["string", "null"] };
const obj = (properties) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});

export const EXTRACTION_SCHEMA = obj({
  projects: {
    type: "array",
    items: obj({
      name: strOrNull,
      what: strOrNull,
      sector: { type: "string", enum: SECTORS },
      city: strOrNull,
      country: strOrNull,
      stage: { type: "string", enum: STAGES },
      people: {
        type: "array",
        items: obj({
          name: str,
          handle: strOrNull,
          role: { type: "string", enum: ROLES },
          affiliation: strOrNull,
          links: { type: "array", items: str },
        }),
      },
      quotes: {
        type: "array",
        items: obj({
          text: str,
          timestamp: strOrNull,
          kind: { type: "string", enum: QUOTE_KINDS },
        }),
      },
      funding_mentioned: obj({ mentioned: { type: "boolean" }, what: strOrNull }),
    }),
  },
});

export function formatTrace(trace) {
  const people = parsePeople(trace.people)
    .map((p) => (p.handle ? `${p.name} (@${p.handle})` : p.name))
    .join(", ");
  return [
    `source: ${trace.source || "unknown"}`,
    `url: ${trace.url || ""}`,
    `happened_at: ${trace.happened_at || ""}`,
    `title: ${trace.title || ""}`,
    `org_name: ${trace.org_name || ""}`,
    `city: ${trace.city || ""}`,
    `people listed by the scout: ${people}`,
    "",
    "text:",
    String(trace.text || "").slice(0, MAX_TRACE_CHARS),
  ].join("\n");
}

export async function extractTrace(trace, llm) {
  const { data, usage } = await llm({
    step: "extract",
    model: MODEL_FAST,
    effort: "low",
    system: EXTRACT_SYSTEM,
    input: formatTrace(trace),
    schema: EXTRACTION_SCHEMA,
    name: "extraction",
    trace,
  });
  if (!data || !Array.isArray(data.projects)) throw new Error("extraction has no projects array");
  return { extraction: data, usage };
}
