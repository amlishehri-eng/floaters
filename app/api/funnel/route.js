import funnelSample from "@/data/funnel.sample.json";

// GET /api/funnel: counts per pipeline stage and cost per stage, per trace and per call_now lead,
// read from the n8n webhook flow "44 Funnel stats" (URL in N8N_FUNNEL_URL).
// If n8n is unreachable (or USE_MOCKS=true): data/funnel.sample.json, a real snapshot with its own as_of, and mocked: true.
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 8_000;
const FUNNEL_URL_DEFAULT = "https://floaters.app.n8n.cloud/webhook/htgf-funnel";

export async function GET() {
  if (process.env.USE_MOCKS === "true") return Response.json({ ...funnelSample, mocked: true });
  try {
    const res = await fetch(process.env.N8N_FUNNEL_URL || FUNNEL_URL_DEFAULT, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) throw new Error(`n8n funnel webhook returned ${res.status}`);
    const data = await res.json();
    if (!data || typeof data !== "object" || !data.stages) throw new Error("n8n funnel webhook returned no stages");
    return Response.json({ ...data, mocked: false });
  } catch (err) {
    console.warn("[funnel] n8n unreachable, serving the snapshot:", err.message);
    return Response.json({ ...funnelSample, mocked: true, n8n_error: err.message });
  }
}
