# Integrations

How Claude, OpenAI, ElevenLabs and n8n are wired in.

```
Browser (app/, components/)
   │  fetch("/api/...")          ← no keys ever in the browser
   ▼
Next.js API routes (app/api/)
   ├── lib/ai/claude.js      → Anthropic API
   ├── lib/ai/openai.js      → OpenAI API (only if SPEC.md needs it)
   ├── lib/voice/elevenlabs.js → ElevenLabs API
   └── lib/n8n.js            → n8n webhook → (email, sheets, Slack, …)
```

Every helper in `lib/` has a **mock fallback** from `/data`, used when the call fails (or when `USE_MOCKS=true`), so the demo still runs if Wi-Fi or an API dies on stage.

## Environment variables
Copy `.env.example` to `.env.local` (Next.js reads it automatically). Share the real values privately, never in the repo. On Vercel, add the same variables under **Project → Settings → Environment Variables**.

| Variable | Used by | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | `lib/ai/claude.js` | console.anthropic.com → API keys |
| `ANTHROPIC_MODEL` | `lib/ai/claude.js` | default `claude-opus-5-5` |
| `OPENAI_API_KEY` | `lib/ai/openai.js` | only if used |
| `OPENAI_MODEL` | `lib/ai/openai.js` | set to the model you pick for that job |
| `ELEVENLABS_API_KEY` | `lib/voice/elevenlabs.js` | elevenlabs.io → Profile → API keys |
| `ELEVENLABS_VOICE_ID` | `lib/voice/elevenlabs.js` | copy from the Voices page |
| `N8N_WEBHOOK_URL_MAIN` | `lib/n8n.js` | the **production** webhook URL (see below) |
| `USE_MOCKS` | all of `lib/` | `true` = skip external APIs, use `/data` |

## Claude (default LLM)
- Package: `@anthropic-ai/sdk`. Server-side only (API routes / `lib/`), never import it in a client component.
- The client reads `ANTHROPIC_API_KEY` from the environment automatically.
- Model comes from `ANTHROPIC_MODEL` (default `claude-opus-5-5`). Keep the model name in that one place.
- On `claude-opus-5-5`, thinking is always on and can't be disabled. For snappy demo replies set `output_config: { effort: "low" }`; use higher effort only where quality matters.
- Always check `stop_reason` before reading the reply: handle `"refusal"` and `"max_tokens"` by showing a clear message (or the mock).
- For long answers, stream the response so the UI doesn't sit blank.
- Keep system prompts in `lib/ai/prompts/` as plain strings so everyone can tweak them.

## OpenAI (only if SPEC.md requires it)
- Package: `openai`. Same rules: server-side only, key from `OPENAI_API_KEY`, model from `OPENAI_MODEL`.
- Write down in SPEC.md ("Which AI does what") why it's needed, e.g. embeddings or image generation.

## ElevenLabs (voice)
- Call it from our own routes: `app/api/voice/tts` (text → audio) and `app/api/voice/stt` (audio → text).
- Auth header: `xi-api-key: ELEVENLABS_API_KEY`.
- TTS returns `audio/mpeg`; stream it back to the browser and play it with an `<audio>` element.
- Fallbacks: a pre-recorded mp3 in `public/demo/`, or the browser's built-in `speechSynthesis`.
- Watch the character quota on the free plan; cache generated audio for the demo script.

## n8n (automations)
- In n8n, start the workflow with a **Webhook** node (method `POST`). End it with **Respond to Webhook** if the app needs data back.
- n8n gives two URLs:
  - **Test URL** (`/webhook-test/...`): only works while you click "Listen for test event". Good for building.
  - **Production URL** (`/webhook/...`): only works when the workflow is **active/published**. Put this one in `N8N_WEBHOOK_URL_MAIN`.
- The app calls it only from `lib/n8n.js` via `fetch` (POST JSON) from an API route, never from the browser.
- n8n must be reachable from Vercel, so use n8n Cloud or a hosted instance; `localhost` won't work once deployed.
- Need a second workflow? Add `N8N_WEBHOOK_URL_<NAME>` to `.env.example` right away.
- After changing a workflow, export it (**⋯ → Download**) into `n8n/` and commit it, so it's backed up and reviewable.

## Mocks and fallbacks
- One file per service in `/data`, e.g. `data/chat.json`, `data/automation.json`, plus `public/demo/*.mp3`.
- Pattern for every helper in `lib/`: if `USE_MOCKS` is `true` → return the mock. Otherwise try the real call, and on error log it, return the mock, and flag it (e.g. `{ ..., mocked: true }`) so the UI can show a small "offline mode" badge instead of failing silently.
