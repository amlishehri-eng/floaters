"use client";

import Link from "next/link";
import { useState } from "react";

// "Bring to the front": a vote, never a verdict change. POST /api/feedback { vote: "up", reason: "brought back from the
// funnel: <sentence>" } puts the company on the Candidates page; Undo sends "down". Errors show next to the button.
// Used on the filtered page and the company page banner; `candidate` says it is already on the Candidates page.

async function send(leadKey, vote, reason) {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lead_key: leadKey, vote, reason }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.ok === false) throw new Error(j.error || `feedback answered ${res.status}`);
  return j;
}

export default function BringToFront({ leadKey, bringReason, candidate = false, dark = false, name = "" }) {
  const [state, setState] = useState(candidate ? "added" : "idle");
  const [note, setNote] = useState("");

  async function bring() {
    setState("saving");
    setNote("");
    try {
      const j = await send(leadKey, "up", bringReason);
      setState("added");
      setNote(j.mocked ? "Saved on this computer only, n8n not reachable." : "");
    } catch (err) {
      setState("idle");
      setNote(`Not saved: ${err.message}.`);
    }
  }

  async function undo() {
    setState("saving");
    setNote("");
    try {
      const j = await send(leadKey, "down", "undo bring to the front");
      setState("idle");
      setNote(j.mocked ? "Undone on this computer only, n8n not reachable." : "Taken off the candidates page.");
    } catch (err) {
      setState("added");
      setNote(`Undo not saved: ${err.message}.`);
    }
  }

  return (
    <span className={`bf${dark ? " bf--dark" : ""}`}>
      {state === "added" ? (
        <>
          <span className="bf-on"><Link href="/proof/candidates">On the candidates page</Link></span>
          <button type="button" className="bf-undo" onClick={undo}>Undo{name && <span className="ff-sr-only">: {name}</span>}</button>
        </>
      ) : (
        <button type="button" className="ff-btn bf-btn" onClick={bring} disabled={state === "saving"}>
          {state === "saving" ? "Saving…" : "Bring to the front"}
          {name && <span className="ff-sr-only">: {name}</span>}
        </button>
      )}
      <span className="bf-note" role="status">{note}</span>
    </span>
  );
}
