import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sttMock from "@/data/stt.json";
import { mocksEnabled, mockFallback } from "@/lib/mocks";

const API = "https://api.elevenlabs.io/v1";
const TTS_MODEL = "eleven_multilingual_v2";
const STT_MODEL = "scribe_v1";
const TIMEOUT_MS = 15_000;
const FALLBACK_MP3 = path.join(process.cwd(), "public", "demo", "fallback.mp3");

function headers() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");
  return { "xi-api-key": key };
}

// Pre-recorded mp3 if there is one, otherwise the frontend uses speechSynthesis.
async function ttsMock() {
  if (existsSync(FALLBACK_MP3)) {
    return { audio: await readFile(FALLBACK_MP3), contentType: "audio/mpeg", mocked: true };
  }
  return { mocked: true };
}

/** Returns { audio, contentType } or, as a fallback, { mocked: true } without audio. */
export async function tts(text) {
  if (mocksEnabled()) return ttsMock();

  try {
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    if (!voiceId) throw new Error("ELEVENLABS_VOICE_ID is not set");

    const res = await fetch(`${API}/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: TTS_MODEL }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`ElevenLabs TTS returned ${res.status}`);

    return { audio: Buffer.from(await res.arrayBuffer()), contentType: "audio/mpeg" };
  } catch (err) {
    console.error("[ElevenLabs] TTS falling back to mock:", err);
    return { ...(await ttsMock()), error: "ElevenLabs unavailable, using fallback" };
  }
}

/** audioBlob: a Blob/File from form-data. Returns { text } plus mocked/error flags. */
export async function stt(audioBlob) {
  if (mocksEnabled()) return { ...sttMock, mocked: true };

  try {
    const form = new FormData();
    form.append("file", audioBlob, audioBlob.name || "audio.webm");
    form.append("model_id", STT_MODEL);

    const res = await fetch(`${API}/speech-to-text`, {
      method: "POST",
      headers: headers(),
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`ElevenLabs STT returned ${res.status}`);

    const data = await res.json();
    return { text: data.text ?? "" };
  } catch (err) {
    return mockFallback(sttMock, "ElevenLabs", err);
  }
}
