import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { brainAuthError, readJson } from "@/lib/ai/brain/auth";

// POST { lead_key, vote: "up" | "down", reason? } -> one row in the n8n data table "Feedback"
// (webhook flow "42 Feedback", URL in N8N_FEEDBACK_URL, default the HTGF project webhook). If n8n is unreachable, or USE_MOCKS=true,
// the vote is kept in data/feedback.local.json (gitignored) and the answer says mocked: true.
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 8_000;
const FEEDBACK_URL_DEFAULT = "https://floaters.app.n8n.cloud/webhook/htgf-feedback";
const LOCAL_FILE = path.join(process.cwd(), "data", "feedback.local.json");
const LEAD_KEY = /^[a-z0-9][a-z0-9:._-]{0,119}$/i;
const MAX_REASON = 500;

function validate(body) {
  const lead_key = typeof body.lead_key === "string" ? body.lead_key.trim() : "";
  if (!LEAD_KEY.test(lead_key)) return { error: "lead_key must be a lead's key (letters, digits, - _ . :), at most 120 characters" };
  if (body.vote !== "up" && body.vote !== "down") return { error: 'vote must be "up" or "down"' };
  if (body.reason != null && typeof body.reason !== "string") return { error: "reason must be text" };
  const reason = (body.reason || "").trim();
  if (reason.length > MAX_REASON) return { error: `reason is longer than ${MAX_REASON} characters` };
  return { vote: { lead_key, vote: body.vote, reason, created_at: new Date().toISOString(), client: "screen" } };
}

async function sendToN8n(vote) {
  const url = process.env.N8N_FEEDBACK_URL || FEEDBACK_URL_DEFAULT;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(vote),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = res.headers.get("content-type")?.includes("application/json") ? await res.json() : {};
  if (!res.ok || data.ok === false) throw new Error(data.error || `n8n feedback webhook returned ${res.status}`);
  return data;
}

// Fallback: keep the vote locally so nothing is lost during the demo (read-only file systems, e.g. Vercel, cannot).
async function keepLocally(vote) {
  let votes = [];
  try {
    votes = JSON.parse(await readFile(LOCAL_FILE, "utf8"));
    if (!Array.isArray(votes)) votes = [];
  } catch {}
  votes.push(vote);
  await mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await writeFile(LOCAL_FILE, JSON.stringify(votes, null, 2) + "\n");
  return votes.length;
}

export async function POST(request) {
  const denied = brainAuthError(request);
  if (denied) return denied;

  const { body, error } = await readJson(request);
  if (error) return error;

  const { vote, error: invalid } = validate(body);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });

  if (process.env.USE_MOCKS !== "true") {
    try {
      const data = await sendToN8n(vote);
      return Response.json({ ok: true, stored: "n8n", row_id: data.row_id ?? null, ...vote });
    } catch (err) {
      console.warn("[feedback] n8n unreachable, keeping the vote locally:", err.message);
      try {
        const count = await keepLocally(vote);
        return Response.json({ ok: true, mocked: true, stored: "data/feedback.local.json", local_votes: count, n8n_error: err.message, ...vote });
      } catch (fileErr) {
        return Response.json({ ok: false, mocked: true, error: `n8n failed (${err.message}) and the local file could not be written (${fileErr.message})` }, { status: 502 });
      }
    }
  }
  try {
    const count = await keepLocally(vote);
    return Response.json({ ok: true, mocked: true, stored: "data/feedback.local.json", local_votes: count, ...vote });
  } catch (fileErr) {
    return Response.json({ ok: false, mocked: true, error: `the local file could not be written (${fileErr.message})` }, { status: 500 });
  }
}
