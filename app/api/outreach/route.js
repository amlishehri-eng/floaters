import { getLeadEnglish } from "@/lib/n8n";
import { draftOutreach } from "@/lib/ai/outreach";

// POST /api/outreach { lead_key, language: "en" | "de" } -> { to_name, founders, to_email | null, website, linkedin | null, subject, subjects[3], body, words, model?, cost_usd?, mocked?, error? }
// A first email from an HTGF investment manager, built only from this lead's evidence (gpt-5.5, up to 45 s); the template in
// lib/ai/outreach.js when the model is off or fails (mocked: true, error says why). Sender from OUTREACH_SENDER_NAME / _TITLE.
export const dynamic = "force-dynamic";
const KEY = /^[a-z0-9][a-z0-9:._-]{0,119}$/i;

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const lead_key = typeof body?.lead_key === "string" ? body.lead_key.trim() : "";
  const language = body?.language === "de" ? "de" : "en";
  if (!KEY.test(lead_key)) return Response.json({ error: "lead_key must be a lead's key" }, { status: 400 });
  if (body?.language && !["en", "de"].includes(body.language)) return Response.json({ error: 'language must be "en" or "de"' }, { status: 400 });
  const lead = await getLeadEnglish(lead_key);
  if (!lead) return Response.json({ error: `no lead with the key "${lead_key}"` }, { status: 404 });
  // test_fallback: true forces the template path (used by scripts/demo-check.mjs to check the fallback).
  return Response.json(await draftOutreach(lead, language, { forceFail: body?.test_fallback === true }));
}
