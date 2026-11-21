"use client";

import { useEffect, useRef, useState } from "react";

// Draft outreach (working prototype): a sheet over the call list with the draft from /api/outreach (gpt-5-mini, or the
// template when the model fails), an editable subject and body, an English/German switch that redrafts, and Copy,
// "Open in mail" (mailto:), "Open LinkedIn" and "Mark as contacted" (/api/outreach/contacted). Errors show in the sheet.

export default function OutreachSheet({ leadKey, name, onClose, onContacted }) {
  const [lang, setLang] = useState("en");
  const [draft, setDraft] = useState(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState("loading"); // loading | ready | error
  const [note, setNote] = useState("");
  const dialog = useRef(null);
  const opener = useRef(null);

  useEffect(() => {
    let live = true;
    fetch("/api/outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead_key: leadKey, language: lang }) })
      .then(async (res) => {
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || `outreach answered ${res.status}`);
        return j;
      })
      .then((j) => {
        if (!live) return;
        setDraft(j);
        setSubject(j.subject);
        setBody(j.body);
        setState("ready");
        if (j.mocked) setNote(`Drafted from a template, the model was not available (${j.error}).`);
      })
      .catch((err) => { if (live) { setState("error"); setNote(`No draft: ${err.message}.`); } });
    return () => { live = false; };
  }, [leadKey, lang]);

  // Focus the sheet on open, give it back on close; Esc closes.
  useEffect(() => {
    opener.current = document.activeElement;
    dialog.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); opener.current?.focus?.(); };
  }, [onClose]);

  async function copy() {
    const all = `Subject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(all);
      setNote("Copied to the clipboard.");
    } catch (err) {
      // Some browsers refuse the clipboard API: select the message and use the older copy command instead.
      const area = document.getElementById("os-body");
      area?.focus();
      area?.select();
      const ok = typeof document.execCommand === "function" && document.execCommand("copy");
      setNote(ok ? "Copied the message to the clipboard." : `Could not copy (${err.message}). The message is selected: press Cmd+C or Ctrl+C.`);
    }
  }

  async function contacted(channel) {
    try {
      const res = await fetch("/api/outreach/contacted", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead_key: leadKey, channel }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || `answered ${res.status}`);
      onContacted(leadKey, j.at);
      setNote("Marked as contacted.");
    } catch (err) {
      setNote(`Not saved: ${err.message}.`);
    }
  }

  const mailto = `mailto:${draft?.to_email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return (
    <div className="os-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="os-sheet" role="dialog" aria-modal="true" aria-labelledby="os-title" tabIndex={-1} ref={dialog}>
        <div className="os-head">
          <h2 id="os-title">Outreach to {name}</h2>
          <button type="button" className="ff-btn ff-btn--secondary" onClick={onClose}>Close</button>
        </div>
        <div className="os-lang" role="group" aria-label="Language">
          {[["en", "English"], ["de", "German"]].map(([k, l]) => (
            <button key={k} type="button" className="os-langbtn" aria-pressed={lang === k} onClick={() => { if (k === lang) return; setState("loading"); setNote(""); setLang(k); }} disabled={state === "loading"}>{l}</button>
          ))}
        </div>
        {state === "loading" && <p className="os-muted" role="status">Drafting…</p>}
        {draft && state !== "loading" && (
          <>
            <p className="os-to">
              To {draft.to_name}
              {draft.to_email ? <> &lt;{draft.to_email}&gt;</> : <span className="os-muted">. No email found, reach out on LinkedIn{draft.linkedin ? "" : " or the website"}.</span>}
            </p>
            <label className="os-label" htmlFor="os-subject">Subject</label>
            <input id="os-subject" className="os-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <label className="os-label" htmlFor="os-body">Message</label>
            <textarea id="os-body" className="os-input os-body" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="os-actions">
              <button type="button" className="ff-btn" onClick={copy}>Copy</button>
              <a className="ff-btn ff-btn--secondary os-linkbtn" href={mailto}>Open in mail</a>
              {draft.linkedin && <a className="ff-btn ff-btn--secondary os-linkbtn" href={draft.linkedin} target="_blank" rel="noreferrer">Open LinkedIn</a>}
              <button type="button" className="ff-btn ff-btn--secondary" onClick={() => contacted(draft.to_email ? "email" : draft.linkedin ? "linkedin" : "copy")}>Mark as contacted</button>
            </div>
          </>
        )}
        <p className="os-muted" role="status">{note}</p>
      </div>
    </div>
  );
}
