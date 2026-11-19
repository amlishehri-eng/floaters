import { tts } from "@/lib/voice/elevenlabs";

const MAX_CHARS = 2_500;

// POST { text } → audio/mpeg, or JSON { mocked: true } so the frontend can use speechSynthesis.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const text = body?.text;
  if (typeof text !== "string" || !text.trim() || text.length > MAX_CHARS) {
    return Response.json({ error: `text must be a non-empty string (max ${MAX_CHARS} chars)` }, { status: 400 });
  }

  const result = await tts(text);
  if (!result.audio) {
    return Response.json({ mocked: true, ...(result.error && { error: result.error }) });
  }

  return new Response(result.audio, {
    headers: {
      "Content-Type": result.contentType,
      ...(result.mocked && { "X-Mocked": "true" }),
    },
  });
}
