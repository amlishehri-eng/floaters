import { getExtras } from "@/lib/n8n";

// GET /api/extras: { as_of, labs (Labs table top 10 by gap_score), backtest (latest blind backtest run), mocked }
// from the n8n webhook flow "46 Screen extras" (URL in N8N_EXTRAS_URL). Falls back to data/labs.sample.json and
// data/backtest.sample.json after 8 s or with USE_MOCKS=true (mocked: true, error says why).
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getExtras());
}
