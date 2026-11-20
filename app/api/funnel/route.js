import { getFunnel } from "@/lib/n8n";

// GET /api/funnel: counts per pipeline stage and cost per stage, per trace and per call_now lead,
// read from the n8n webhook flow "44 Funnel stats" (URL in N8N_FUNNEL_URL).
// If n8n is unreachable within 8 s (or USE_MOCKS=true): data/funnel.sample.json, a real snapshot with its own as_of, and mocked: true.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getFunnel());
}
