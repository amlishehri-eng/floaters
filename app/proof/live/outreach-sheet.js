"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Draft outreach: a centred dialog over the call list with the draft from /api/outreach (gpt-5.5). When the model
// fails the dialog says why and offers Redraft; it never shows a stand-in text. Recipient line, English/German switch (redrafts), subject with three suggested lines,
// an auto-growing message, and Copy, Open in mail (mailto:), Open LinkedIn, Mark as contacted and Redraft.
// Focus stays inside the dialog (Tab cycles), Esc or the backdrop closes it, focus goes back to the button that opened it.

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function OutreachSheet({ leadKey, name, onClose, onContacted }) {
  const [lang, setLang] = useState("en");
  const [round, setRound] = useState(0); // Redraft bumps this
  const [draft, setDraft] = useState(null);
  const [recipient, setRecipient] = useState(null); // recipient fields when the draft failed
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState("loading"); // loading | ready | error
  const [note, setNote] = useState({ text: "", tone: "" });
  const dialog = useRef(null);
  const area = useRef(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);

  useEffect(() => {
    let live = true;
    fetch("/api/outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead_key: leadKey, language: lang }) })
      .then(async (res) => {
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.body) throw Object.assign(new Error(j.error || `outreach answered ${res.status}`), { recipient: j.to_name ? j : null });
        return j;
      })
      .then((j) => {
        if (!live) return;
        setDraft(j);
        setSubject(j.subject);
        setBody(j.body);
        setState("ready");
        setNote({ text: `Drafted by ${j.model} from this team's sources only${j.cost_usd ? ` ($${j.cost_usd.toFixed(3)})` : ""}. Check every fact before sending.`, tone: "" });
      })
      .catch((err) => {
        if (!live) return;
        setDraft(null);
        setRecipient(err.recipient);
        setState("error");
        setNote({ text: `No draft: the model call failed (${err.message}). Try Redraft.`, tone: "warn" });
      });
    return () => { live = false; };
  }, [leadKey, lang, round]);

  // Open: remember the opener and focus the dialog. Close: give focus back. Esc closes, Tab stays inside.
  useEffect(() => {
    const opener = document.activeElement;
    dialog.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); close.current(); return; }
      if (e.key !== "Tab" || !dialog.current) return;
      const items = [...dialog.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; opener?.focus?.(); };
  }, []);

  // The message grows with its text (at least 12 rows, set in CSS).
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [body, state]);

  function redraft(nextLang = lang) {
    setState("loading");
    setNote({ text: "", tone: "" });
    if (nextLang !== lang) setLang(nextLang);
    else setRound((r) => r + 1);
  }

  async function copy() {
    const all = `Subject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(all);
      setNote({ text: "Copied subject and message to the clipboard.", tone: "ok" });
    } catch (err) {
      // Some browsers refuse the clipboard API: select the message and use the older copy command instead.
      area.current?.focus();
      area.current?.select();
      const ok = typeof document.execCommand === "function" && document.execCommand("copy");
      setNote(ok ? { text: "Copied the message to the clipboard.", tone: "ok" } : { text: `Could not copy (${err.message}). The message is selected: press Cmd+C or Ctrl+C.`, tone: "warn" });
    }
  }

  async function contacted(channel) {
    try {
      const res = await fetch("/api/outreach/contacted", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead_key: leadKey, channel }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || `answered ${res.status}`);
      onContacted(leadKey, j.at);
      setNote({ text: "Marked as contacted. The call list and the company page show the date.", tone: "ok" });
    } catch (err) {
      setNote({ text: `Not saved: ${err.message}.`, tone: "warn" });
    }
  }

  const to = draft || recipient;
  const mailto = `mailto:${draft?.to_email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const busy = state === "loading";
  return (
    <div className="os-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="os-dialog" role="dialog" aria-modal="true" aria-labelledby="os-title" aria-busy={busy} tabIndex={-1} ref={dialog}>
        <div className="os-head">
          <h2 id="os-title">Outreach to {name}</h2>
          <button type="button" className="os-close" onClick={onClose} aria-label="Close">Close</button>
        </div>

        <div className="os-meta">
          <p className="os-to">
            {to ? (
              <>
                <span className="os-to__k">To</span> <strong>{to.founders?.length ? to.founders.join(", ") : to.to_name}</strong>
                <span className="os-to__sep" aria-hidden="true">·</span>
                {to.to_email ? <span>{to.to_email}</span> : <span className="os-muted">No email found</span>}
                {to.linkedin && <><span className="os-to__sep" aria-hidden="true">·</span><a href={to.linkedin} target="_blank" rel="noreferrer">LinkedIn</a></>}
                {to.website && <><span className="os-to__sep" aria-hidden="true">·</span><a href={to.website} target="_blank" rel="noreferrer">Website</a></>}
              </>
            ) : <span className="os-muted">{state === "error" ? "No draft" : "Finding the founders…"}</span>}
          </p>
          <div className="os-lang" role="group" aria-label="Language of the email">
            {[["en", "English"], ["de", "German"]].map(([k, l]) => (
              <button key={k} type="button" className="os-langbtn" aria-pressed={lang === k} disabled={busy} onClick={() => k !== lang && redraft(k)}>{l}</button>
            ))}
          </div>
        </div>

        {busy && (
          <div className="os-loading" role="status">
            <span className="os-spinner" aria-hidden="true" />
            {draft ? "Redrafting…" : "Drafting from this team's sources, about 10 seconds…"}
          </div>
        )}

        {draft && !busy && (
          <>
            <div className="os-field">
              <label className="os-label" htmlFor="os-subject">Subject</label>
              <input id="os-subject" className="os-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
              {draft.subjects?.length > 1 && (
                <div className="os-chips" role="group" aria-label="Suggested subject lines">
                  {draft.subjects.map((s) => (
                    <button key={s} type="button" className="os-chip" aria-pressed={s === subject} onClick={() => setSubject(s)}>{s}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="os-field">
              <label className="os-label" htmlFor="os-body">Message</label>
              <textarea id="os-body" ref={area} className="os-input os-body" rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
          </>
        )}

        <p className={`os-note${note.tone ? ` os-note--${note.tone}` : ""}`} role="status">{note.text}</p>

        <div className="os-actions">
          <button type="button" className="ff-btn" onClick={copy} disabled={!draft || busy}>Copy</button>
          {draft && !busy ? <a className="ff-btn ff-btn--secondary os-linkbtn" href={mailto}>Open in mail</a> : <button type="button" className="ff-btn ff-btn--secondary" disabled>Open in mail</button>}
          {draft?.linkedin && <a className="ff-btn ff-btn--secondary os-linkbtn" href={draft.linkedin} target="_blank" rel="noreferrer">Open LinkedIn</a>}
          <button type="button" className="ff-btn ff-btn--secondary" disabled={!draft || busy} onClick={() => contacted(draft.to_email ? "email" : draft.linkedin ? "linkedin" : "copy")}>Mark as contacted</button>
          <button type="button" className="ff-btn ff-btn--secondary os-redraft" disabled={busy} onClick={() => redraft()}>Redraft</button>
        </div>
      </div>
    </div>
  );
}
