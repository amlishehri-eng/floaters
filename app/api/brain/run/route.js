import leadsMock from "@/data/leads.sample.json";
import { openaiOff } from "@/lib/ai/openai";
import { brainAuthError, readJson } from "@/lib/ai/brain/auth";
import { runBrain } from "@/lib/ai/brain/run";

// A full run makes many OpenAI calls (extraction, filter, scoring, web search).
export const maxDuration = 300;

const MAX_TRACES = 2000;

// POST { traces: [...], previous_leads?: [...], options?: { daysAhead } }
// → { leads, rows, trace_updates, funnel, cost, errors, mocked? }
export async function POST(request) {
  const denied = brainAuthError(request);
  if (denied) return denied;

  const { body, error } = await readJson(request);
  if (error) return error;

  const { traces, previous_leads = [] } = body;
  if (!Array.isArray(traces) || traces.length > MAX_TRACES) {
    return Response.json({ error: `traces must be an array of up to ${MAX_TRACES} rows` }, { status: 400 });
  }
  if (!traces.every((t) => t && typeof t === "object" && t.id)) {
    return Response.json({ error: "every trace needs an id" }, { status: 400 });
  }
  if (!Array.isArray(previous_leads)) {
    return Response.json({ error: "previous_leads must be an array" }, { status: 400 });
  }

  if (openaiOff()) return Response.json({ ...leadsMock, mocked: true });

  try {
    return Response.json(await runBrain({ traces, previous_leads, options: body.options || {} }));
  } catch (err) {
    console.error("[brain] run failed:", err);
    return Response.json({ error: `brain run failed: ${err.message}` }, { status: 500 });
  }
}
