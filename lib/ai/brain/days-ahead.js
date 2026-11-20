// Step 5: Days ahead. Fast model + OpenAI web_search finds the first dated public mention.
import { MODEL_FAST } from "../openai.js";
import { DAYS_AHEAD_SYSTEM } from "../prompts/brain.js";
import { daysBetween, toDay } from "./normalize.js";

const DAYS_AHEAD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["first_public_at", "first_public_url", "on_crunchbase", "funding_announced", "note"],
  properties: {
    first_public_at: { type: ["string", "null"] },
    first_public_url: { type: ["string", "null"] },
    on_crunchbase: { type: "boolean" },
    funding_announced: { type: "boolean" },
    note: { type: "string" },
  },
};

export const PUBLIC_SIGNAL_KIND = "first_public_mention";

export async function findFirstPublic(lead, llm) {
  const people = lead.people.map((p) => `${p.name}${p.affiliation ? ` (${p.affiliation})` : ""}`).join(", ");
  const { data, usage } = await llm({
    step: "days_ahead",
    model: MODEL_FAST,
    system: DAYS_AHEAD_SYSTEM,
    input: `Project: ${lead.name || "(no name)"}\nWhat: ${lead.what || "?"}\nPeople: ${people || "?"}\nCity: ${lead.city || "?"}, ${lead.country || "?"}\nOur first trace: ${lead.first_trace_at || "?"}`,
    schema: DAYS_AHEAD_SCHEMA,
    name: "first_public_mention",
    webSearch: true,
    lead,
  });
  return { ...data, first_public_at: toDay(data.first_public_at), usage };
}

// The public mention becomes a signal so the lead card shows its date and link.
export function publicSignal(found) {
  if (!found.first_public_at) return null;
  const tags = [found.on_crunchbase && "on Crunchbase/Dealroom", found.funding_announced && "funding announced"].filter(Boolean);
  return {
    trace_id: null,
    source: "web",
    kind: PUBLIC_SIGNAL_KIND,
    quote: [found.note, ...tags].filter(Boolean).join(" · "),
    timestamp: null,
    url: found.first_public_url || null,
    happened_at: found.first_public_at,
    title: "First public mention",
  };
}

// days_ahead = first public − first trace, or days since the first trace if still invisible.
export function daysAhead(firstTraceAt, firstPublicAt, today) {
  if (!firstTraceAt) return null;
  return firstPublicAt ? daysBetween(firstTraceAt, firstPublicAt) : daysBetween(firstTraceAt, today);
}
