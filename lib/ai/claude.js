import Anthropic from "@anthropic-ai/sdk";
import chatMock from "@/data/chat.json";
import { mocksEnabled, mockFallback } from "@/lib/mocks";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

// Short timeout + one retry: on stage a fast fallback beats a long spinner.
let client;
function getClient() {
  client ??= new Anthropic({ timeout: 30_000, maxRetries: 1 });
  return client;
}

function replyText(response) {
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

/**
 * messages: [{ role: "user" | "assistant", content: "..." }]
 * Returns { reply } plus flags: refused, truncated, mocked, error.
 */
export async function chat(messages, { system } = {}) {
  if (mocksEnabled()) return { ...chatMock, mocked: true };

  try {
    const response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system,
      messages,
      // Low effort keeps chat replies snappy for a live demo.
      output_config: { effort: "low" },
      // If the model declines for policy reasons, the API retries on a server-chosen fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    if (response.stop_reason === "refusal") {
      return { reply: "Sorry, I can't help with that one. Try rephrasing.", refused: true };
    }

    const reply = replyText(response);
    if (response.stop_reason === "max_tokens") {
      return { reply: `${reply} …`, truncated: true };
    }
    return { reply };
  } catch (err) {
    return mockFallback(chatMock, "Claude", err);
  }
}
