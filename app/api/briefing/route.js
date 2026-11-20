import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import briefingSample from "@/data/briefing.sample.json";
import funnelSample from "@/data/funnel.sample.json";
import { buildBriefing, scriptHash } from "@/lib/voice/briefing";
import { TTS_MODEL_ID } from "@/lib/voice/elevenlabs";

// GET /api/briefing?lang=en|de&format=json|audio[&source=sample]
// Spoken top-5 briefing: the top leads (call_now first, then by priority) and the funnel totals, as a script
// written in code (no model), spoken by ElevenLabs through n8n flow "45 Text to speech" (N8N_TTS_URL; the key lives in
// the n8n credential "xi-api-key"). Audio is cached by a hash of the script in data/briefing-cache/, checked before n8n.
// Fallback (n8n or ElevenLabs down, USE_MOCKS=true, or source=sample): data/briefing.sample.json and
// data/briefing.sample.mp3, with mocked: true (header X-Mocked: true on audio). If there is no sample mp3 either,
// format=audio answers JSON { mocked: true, script } so the screen can speak it with speechSynthesis.
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 8_000;
// ~60 s of speech takes ElevenLabs longer than a page fetch; cached renders are instant.
const TTS_TIMEOUT_MS = 20_000;
const LEADS_URL_DEFAULT = "https://floaters.app.n8n.cloud/webhook/htgf-leads";
const FUNNEL_URL_DEFAULT = "https://floaters.app.n8n.cloud/webhook/htgf-funnel";
const TTS_URL_DEFAULT = "https://floaters.app.n8n.cloud/webhook/htgf-tts";
const CACHE_DIR = path.join(process.cwd(), "data", "briefing-cache");
const SAMPLE_MP3 = path.join(process.cwd(), "data", "briefing.sample.mp3");
const LANGS = ["en", "de"];
const FORMATS = ["json", "audio"];

async function getJson(url, what) {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${what} returned ${res.status}`);
  return res.json();
}

// Raw Leads rows from flow "20 Leads for the screen" (same link as lib/n8n.js getLeads, which drops
// verdict, priority and next_step on its way to the dashboard).
async function liveLeads() {
  const data = await getJson(process.env.N8N_LEADS_URL || LEADS_URL_DEFAULT, 'n8n leads link (is "20 Leads for the screen" published?)');
  if (!Array.isArray(data?.leads)) throw new Error("n8n leads link returned no leads");
  return { leads: data.leads, as_of: data.as_of || null };
}

async function liveFunnel() {
  try {
    const data = await getJson(process.env.N8N_FUNNEL_URL || FUNNEL_URL_DEFAULT, "n8n funnel webhook");
    if (!data?.stages) throw new Error("n8n funnel webhook returned no stages");
    return { funnel: data, error: null };
  } catch (err) {
    console.warn("[briefing] funnel unreachable, using the snapshot totals:", err.message);
    return { funnel: funnelSample, error: err.message };
  }
}

function sampleBriefing(lang, reason) {
  const b = briefingSample.by_lang?.[lang] || briefingSample.by_lang?.en;
  return { ...b, as_of: briefingSample.as_of, rendered_at: briefingSample.rendered_at, mocked: true, source: "sample", ...(reason && { error: reason }) };
}

async function makeBriefing(lang, forceSample) {
  if (forceSample) return sampleBriefing(lang, null);
  if (process.env.USE_MOCKS === "true") return sampleBriefing(lang, null);
  try {
    const [{ leads, as_of }, { funnel, error: funnelError }] = await Promise.all([liveLeads(), liveFunnel()]);
    const b = buildBriefing({ leads, funnel, lang });
    if (!b.leads.length) throw new Error("no lead passed the gates (call_now, watchlist, needs_enrichment)");
    const voiceId = process.env.ELEVENLABS_VOICE_ID || "n8n-default";
    return {
      lang,
      ...b,
      script_hash: scriptHash(b.script, { lang, voiceId, model: TTS_MODEL_ID }),
      as_of: as_of || funnel.as_of || new Date().toISOString(),
      mocked: Boolean(funnelError),
      source: "live",
      ...(funnelError && { funnel_mocked: true, error: `funnel from the snapshot: ${funnelError}` }),
    };
  } catch (err) {
    console.warn("[briefing] live leads unavailable, serving the sample:", err.message);
    return sampleBriefing(lang, err.message);
  }
}

const cachePath = (hash) => path.join(CACHE_DIR, `${hash}.mp3`);

async function readCache(hash) {
  try {
    return await readFile(cachePath(hash));
  } catch {
    return null;
  }
}

// Read-only file systems (Vercel) cannot cache; that only costs a re-render.
async function writeCache(hash, audio) {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cachePath(hash), audio);
  } catch (err) {
    console.warn("[briefing] could not cache the audio:", err.message);
  }
}

function audioResponse(audio, b, extra = {}) {
  return new Response(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "X-Script-Hash": b.script_hash || "",
      "X-Briefing-Source": b.source,
      ...(b.mocked && { "X-Mocked": "true" }),
      ...extra,
    },
  });
}

// The sample's own mp3 always matches the sample's en script.
async function sampleAudio(lang, reason) {
  const b = sampleBriefing(lang, reason);
  if (existsSync(SAMPLE_MP3)) {
    return audioResponse(await readFile(SAMPLE_MP3), b, {
      "X-Briefing-Lang": briefingSample.audio_lang || "en",
      ...(reason && { "X-Briefing-Error": encodeURIComponent(reason).slice(0, 300) }),
    });
  }
  return Response.json({ ...b, audio: null, error: [reason, "no data/briefing.sample.mp3: speak the script with speechSynthesis"].filter(Boolean).join("; ") });
}

// n8n flow "45 Text to speech": POST { text, voice_id?, hash } -> audio/mpeg (400 / 502 JSON on errors).
async function speakViaN8n(b) {
  const res = await fetch(process.env.N8N_TTS_URL || TTS_URL_DEFAULT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: b.script, hash: b.script_hash, ...(process.env.ELEVENLABS_VOICE_ID && { voice_id: process.env.ELEVENLABS_VOICE_ID }) }),
    cache: "no-store",
    signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
  });
  const type = res.headers.get("content-type") || "";
  if (!res.ok || !type.includes("audio")) {
    const detail = type.includes("json") ? (await res.json().catch(() => ({}))).error : "";
    throw new Error(`webhook returned ${res.status}${detail ? ` (${detail})` : ""}`);
  }
  const audio = Buffer.from(await res.arrayBuffer());
  if (audio.length < 1000) throw new Error(`webhook returned only ${audio.length} bytes`);
  return audio;
}

async function briefingAudio(b) {
  if (b.source === "sample") return sampleAudio(b.lang, b.error);

  const cached = await readCache(b.script_hash);
  if (cached) return audioResponse(cached, b, { "X-Cache": "hit" });

  let audio;
  try {
    audio = await speakViaN8n(b);
  } catch (err) {
    console.warn("[briefing] n8n text to speech failed, serving the sample mp3:", err.message);
    return sampleAudio(b.lang, `n8n text to speech failed: ${err.message}`);
  }
  await writeCache(b.script_hash, audio);
  return audioResponse(audio, b, { "X-Cache": "miss" });
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const lang = params.get("lang") || "en";
  const format = params.get("format") || "json";
  if (!LANGS.includes(lang)) return Response.json({ error: `lang must be one of ${LANGS.join(", ")}` }, { status: 400 });
  if (!FORMATS.includes(format)) return Response.json({ error: `format must be one of ${FORMATS.join(", ")}` }, { status: 400 });

  const b = await makeBriefing(lang, params.get("source") === "sample");
  if (format === "audio") return briefingAudio(b);

  const audio_cached = b.source === "sample" ? existsSync(SAMPLE_MP3) : Boolean(b.script_hash && existsSync(cachePath(b.script_hash)));
  return Response.json({ ...b, audio_cached, audio_url: `/api/briefing?lang=${lang}&format=audio${b.source === "sample" ? "&source=sample" : ""}` });
}
