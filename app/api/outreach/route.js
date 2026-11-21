import { getLeadEnglish } from "@/lib/n8n";
import { draftOutreach } from "@/lib/ai/outreach";

// POST /api/outreach { lead_key, language: "en" | "de" } -> { to_name, founders, to_email | null, website, linkedin | null, subject, subjects[3], body, words, model?, cost_usd?, mocked?, error? }
// A first email from an HTGF investment manager, built only from this lead's evidence (gpt-5.5, up to 45 s). When the
// model is off or fails: 502 with { error } and the recipient fields, no draft. Sender from OUTREACH_SENDER_NAME / _TITLE.
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
  // test_fallback: true forces a model failure (scripts/demo-check.mjs checks that the error comes back, not a draft).
  const draft = await draftOutreach(lead, language, { forceFail: body?.test_fallback === true });
  return Response.json(draft, { status: draft.error ? 502 : 200 });
}
