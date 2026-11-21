import { markContacted } from "@/lib/ai/outreach";

// POST /api/outreach/contacted { lead_key, channel: "email" | "linkedin" | "copy" } -> { ok, lead_key, at, channel }
// Kept in data/outreach.local.json (gitignored), the same fallback style as feedback. The call list and the company page
// show "Contacted 21 Nov". A read-only file system (Vercel) answers 500 with the reason.
export const dynamic = "force-dynamic";
const KEY = /^[a-z0-9][a-z0-9:._-]{0,119}$/i;
const CHANNELS = ["email", "linkedin", "copy"];

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const lead_key = typeof body?.lead_key === "string" ? body.lead_key.trim() : "";
  if (!KEY.test(lead_key)) return Response.json({ error: "lead_key must be a lead's key" }, { status: 400 });
  const channel = CHANNELS.includes(body?.channel) ? body.channel : "email";
  try {
    return Response.json({ ok: true, ...(await markContacted({ lead_key, channel })) });
  } catch (err) {
    return Response.json({ ok: false, error: `could not save the contact (${err.message})` }, { status: 500 });
  }
}
