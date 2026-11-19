import { stt } from "@/lib/voice/elevenlabs";

const MAX_BYTES = 25 * 1024 * 1024;

// POST form-data with an "audio" file → { text }
export async function POST(request) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Body must be multipart/form-data with an \"audio\" file" }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return Response.json({ error: "\"audio\" must be a non-empty file" }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return Response.json({ error: "\"audio\" is too large (max 25 MB)" }, { status: 400 });
  }

  const result = await stt(audio);
  return Response.json(result);
}
