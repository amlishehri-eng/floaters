import tracesMock from "@/data/traces.sample.json";
import { brainAuthError, readJson } from "@/lib/ai/brain/auth";
import { extractTrace } from "@/lib/ai/brain/extract";
import { openaiOff, structured } from "@/lib/ai/openai";

export const maxDuration = 60;

// POST { trace } → { extraction, usage }. For debugging one trace.
export async function POST(request) {
  const denied = brainAuthError(request);
  if (denied) return denied;

  const { body, error } = await readJson(request);
  if (error) return error;

  const trace = body.trace;
  if (!trace || typeof trace !== "object" || !trace.text) {
    return Response.json({ error: "body needs { trace } with at least a text field" }, { status: 400 });
  }

  if (openaiOff()) {
    const sample = tracesMock.find((t) => t.id === trace.id) || tracesMock[0];
    return Response.json({ extraction: JSON.parse(sample.extraction), usage: null, mocked: true });
  }

  try {
    return Response.json(await extractTrace(trace, structured));
  } catch (err) {
    console.error("[brain] extract failed:", err);
    return Response.json({ error: `extraction failed: ${err.message}`, usage: err.usage || null }, { status: 502 });
  }
}
