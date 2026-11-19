import { chat } from "@/lib/ai/claude";

const MAX_MESSAGES = 50;
const MAX_CHARS = 10_000;

function isValidMessage(m) {
  return (
    m &&
    (m.role === "user" || m.role === "assistant") &&
    typeof m.content === "string" &&
    m.content.trim().length > 0 &&
    m.content.length <= MAX_CHARS
  );
}

// POST { messages: [{ role, content }] } → { reply }
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return Response.json({ error: `messages must be an array of 1-${MAX_MESSAGES} items` }, { status: 400 });
  }
  if (!messages.every(isValidMessage)) {
    return Response.json(
      { error: `each message needs role "user" or "assistant" and non-empty string content (max ${MAX_CHARS} chars)` },
      { status: 400 },
    );
  }
  if (messages[0].role !== "user") {
    return Response.json({ error: "the first message must have role \"user\"" }, { status: 400 });
  }

  const result = await chat(messages.map(({ role, content }) => ({ role, content })));
  return Response.json(result);
}
