import { getLeads } from "@/lib/n8n";

// GET /api/leads: the same leads as /proof/live, as JSON (for other pages or a quick check).
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getLeads());
}
