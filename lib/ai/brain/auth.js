// Optional shared secret: when BRAIN_API_KEY is set, n8n must send it as header x-brain-key.
export function brainAuthError(request) {
  const key = process.env.BRAIN_API_KEY;
  if (!key || request.headers.get("x-brain-key") === key) return null;
  return Response.json({ error: "missing or wrong x-brain-key header" }, { status: 401 });
}

export async function readJson(request) {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return { body };
  } catch {}
  return { error: Response.json({ error: "Body must be a JSON object" }, { status: 400 }) };
}
