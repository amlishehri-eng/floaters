"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// One button per integration, so we can check Claude / ElevenLabs / n8n in under a minute.
const checks = [
  {
    id: "chat",
    label: "Claude → /api/chat",
    run: () => postJson("/api/chat", { messages: [{ role: "user", content: "Say hi in five words." }] }),
  },
  { id: "tts", label: "ElevenLabs → /api/voice/tts", run: runTts },
  {
    id: "automation",
    label: "n8n → /api/automation",
    run: () => postJson("/api/automation", { test: true, sentAt: new Date().toISOString() }),
  },
];

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, mocked: Boolean(data.mocked), data };
}

async function runTts() {
  const text = "Hello from the test panel.";
  const res = await fetch("/api/voice/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (res.headers.get("content-type")?.includes("audio")) {
    const audio = new Audio(URL.createObjectURL(await res.blob()));
    await audio.play();
    const mocked = res.headers.get("X-Mocked") === "true";
    return { status: res.status, mocked, data: mocked ? "played fallback mp3" : "played ElevenLabs audio" };
  }

  // No audio at all: fall back to the browser's voice.
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  return { status: res.status, mocked: true, data: await res.json() };
}

function ResultBox({ result }) {
  if (!result) return null;
  if (result.loading) return <p className="text-sm text-slate-500">Running…</p>;
  if (result.failed) return <p className="text-sm text-red-600">Failed: {result.failed}</p>;

  return (
    <div className="space-y-1">
      <p className="text-sm">
        HTTP {result.status}{" "}
        {result.mocked ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">mock / fallback</span>
        ) : (
          <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-800">real API</span>
        )}
      </p>
      <pre className="overflow-x-auto rounded bg-slate-100 p-2 text-xs">
        {typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2)}
      </pre>
    </div>
  );
}

export default function TestPanel() {
  const [results, setResults] = useState({});

  async function runCheck(check) {
    setResults((r) => ({ ...r, [check.id]: { loading: true } }));
    try {
      const result = await check.run();
      setResults((r) => ({ ...r, [check.id]: result }));
    } catch (err) {
      setResults((r) => ({ ...r, [check.id]: { failed: err.message } }));
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">Integration test panel</h1>
        <p className="text-sm text-slate-600">
          Each button hits one API route. Amber means the route answered from a mock or fallback (missing key,
          API down, or USE_MOCKS=true).
        </p>
      </div>
      {checks.map((check) => (
        <section key={check.id} className="space-y-2 rounded-lg border p-4">
          <Button onClick={() => runCheck(check)} disabled={results[check.id]?.loading}>
            {check.label}
          </Button>
          <ResultBox result={results[check.id]} />
        </section>
      ))}
    </main>
  );
}
