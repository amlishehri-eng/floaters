import { trigger } from "@/lib/n8n";

// POST { ...any JSON object } → { ok: true, ... } (forwarded to the n8n webhook)
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  const result = await trigger(body);
  return Response.json(result);
}
