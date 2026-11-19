import automationMock from "@/data/automation.json";
import { mocksEnabled, mockFallback } from "@/lib/mocks";

const TIMEOUT_MS = 10_000;

/** POSTs payload to the main n8n webhook. Returns { ok: true, ...whatever n8n responds }. */
export async function trigger(payload) {
  if (mocksEnabled()) return { ...automationMock, mocked: true };

  try {
    const url = process.env.N8N_WEBHOOK_URL_MAIN;
    if (!url) throw new Error("N8N_WEBHOOK_URL_MAIN is not set");

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`n8n webhook returned ${res.status}`);

    // "Respond to Webhook" may send JSON, text, or nothing at all.
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await res.json() : {};
    return { ok: true, ...(data && typeof data === "object" && !Array.isArray(data) ? data : { data }) };
  } catch (err) {
    return mockFallback(automationMock, "n8n", err);
  }
}
