"use client";

import { useRef, useState } from "react";
import { downloadMemo } from "../(legacy)/proof-dashboard";

// Call list (design/reference/call-list.dc.html): lead rows on the left, the detail sheet on the right.
// All values arrive prepared by lib/screen/call-list.js; this file only renders and handles the buttons.

function Row({ row, selected, onPick }) {
  return (
    <button type="button" className="cl-row" aria-pressed={selected} onClick={onPick} data-selected={selected || undefined}>
      <span className="cl-row__top">
        <span className="cl-row__name">{row.name}</span>
        {row.callNow && (
          <span className="cl-callnow"><span className="ff-dot" aria-hidden="true" />Call now</span>
        )}
      </span>
      <span className="cl-row__place">{row.place}</span>
      <span className="cl-row__badges">
        <span style={{ color: row.daysInk }}>{row.daysBadge}</span>
        <span className="cl-row__funding">{row.fundingBadge}</span>
      </span>
      <span className="cl-row__scores">
        <span>Fit <strong>{row.fit}</strong></span>
        <span>Team <strong>{row.team}</strong></span>
        <span>Timing <strong>{row.timing}</strong></span>
      </span>
    </button>
  );
}

function Ring({ r }) {
  return (
    <div className="cl-ring">
      <div
        className="cl-ring__disc"
        style={{ background: `conic-gradient(${r.color} ${r.deg}deg, #eef1f6 0deg)` }}
        role="img"
        aria-label={r.aria}
      >
        <div className="cl-ring__inner" aria-hidden="true">{r.value}</div>
      </div>
      <span className="cl-ring__label">{r.label}</span>
      <span className="cl-ring__sub">{r.sub}</span>
    </div>
  );
}

function Bar({ r, fill }) {
  return (
    <div className="cl-bar">
      <span className="cl-bar__head">
        <span>{r.label}</span>
        {r.url ? (
          <a href={r.url} target="_blank" rel="noreferrer" title={r.quote || undefined} style={{ color: r.ink }}>
            {r.shown}<span className="ff-sr-only">, source for {r.label}</span>
          </a>
        ) : (
          <span style={{ color: r.ink }}>{r.shown}</span>
        )}
      </span>
      <span className="cl-bar__track"><span style={{ width: `${r.pct}%`, background: fill }} /></span>
    </div>
  );
}

function Spec({ title, aside, children }) {
  return (
    <div className="cl-spec">
      {aside ? (
        <div className="cl-spec__label">
          <h3>{title}</h3>
          <span>{aside}</span>
        </div>
      ) : (
        <h3>{title}</h3>
      )}
      {children}
    </div>
  );
}

function useBriefing() {
  const [state, setState] = useState({ busy: false, note: "" });
  const audio = useRef(null);
  async function play() {
    if (audio.current && !audio.current.paused) {
      audio.current.pause();
      setState({ busy: false, note: "Briefing paused." });
      return;
    }
    setState({ busy: true, note: "Loading the briefing…" });
    try {
      const res = await fetch("/api/briefing?format=audio");
      const type = res.headers.get("content-type") || "";
      if (type.includes("audio/")) {
        const url = URL.createObjectURL(await res.blob());
        audio.current = new Audio(url);
        audio.current.onended = () => setState({ busy: false, note: "Briefing finished." });
        await audio.current.play();
        const sample = res.headers.get("x-mocked") === "true";
        setState({ busy: false, note: sample ? "Playing the recorded sample briefing, the live one could not be made." : "Playing today’s briefing." });
        return;
      }
      const j = await res.json();
      if (j.script && typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(j.script));
        setState({ busy: false, note: "No audio available, so your browser reads the briefing aloud." });
        return;
      }
      throw new Error(j.error || `briefing answered ${res.status}`);
    } catch (err) {
      setState({ busy: false, note: `The briefing could not play: ${err.message}.` });
    }
  }
  return { ...state, play };
}

function useFeedback() {
  const [note, setNote] = useState({});
  async function vote(key, value) {
    setNote((n) => ({ ...n, [key]: "Saving your vote…" }));
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_key: key, vote: value }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.error && !j.mocked) throw new Error(j.error || `feedback answered ${res.status}`);
      setNote((n) => ({ ...n, [key]: j.mocked ? "Saved on this computer only, because n8n did not answer." : "Thanks, your vote is saved." }));
    } catch (err) {
      setNote((n) => ({ ...n, [key]: `Your vote was not saved: ${err.message}.` }));
    }
  }
  return { note, vote };
}

function Detail({ s, feedback }) {
  return (
    <article aria-label="Lead detail" className="cl-sheet">
      <div className="cl-head">
        <div className="cl-head__text">
          <span className="cl-head__place">{s.place}</span>
          <h2>{s.name}</h2>
          <p className="cl-head__what">{s.what}</p>
          <p className="cl-head__people">{s.people}</p>
          {s.website && <a href={s.website} target="_blank" rel="noreferrer" className="cl-head__site">{s.websiteLabel}</a>}
        </div>
        <div className="cl-rings" aria-label="Scores">
          {s.rings.map((r) => <Ring key={r.label} r={r} />)}
        </div>
      </div>

      <div className="cl-why">
        <span className="cl-why__title"><span className="ff-dot cl-why__dot" aria-hidden="true" />{s.callNow ? "Why call now" : "Why it is on the list"}</span>
        <span className="cl-why__reason">{s.reason}</span>
        <span className="cl-why__next">Next step: {s.next}</span>
      </div>

      {s.ageWarning && <p className="cl-age">Check the age first. {s.ageWarning}</p>}

      <div className="cl-specs">
        <Spec title="Why now">
          <div className="cl-stack">
            <p className="cl-days" style={{ color: s.daysInk }}>{s.days.badge}</p>
            <p className="cl-days__text">
              {s.days.text}{" "}
              {s.days.pressUrl && <a href={s.days.pressUrl} target="_blank" rel="noreferrer">See the first mention</a>}
            </p>
            <div className="cl-timing">
              {s.timingRows.map((r) => (
                <div key={r.label} className="cl-timing__item">
                  <span className="cl-muted13">{r.label}</span>
                  <span className="cl-bar__track cl-bar__track--4"><span style={{ width: `${r.pct}%`, background: "#33d1ff" }} /></span>
                  <span className="cl-13" style={r.pts === null ? { color: "#6e6e73" } : undefined}>{r.pts === null ? "not known" : `${r.pts} of ${r.max}`}</span>
                </div>
              ))}
            </div>
          </div>
        </Spec>

        <Spec title="HTGF check">
          <div>
            {s.checks.map((c) => (
              <div key={c.key} className="cl-check">
                <span className="cl-check__label">{c.label}</span>
                <span className="cl-check__result" style={{ color: c.ink }}><span style={{ background: c.dot }} aria-hidden="true" />{c.result}</span>
                <span className="cl-check__evidence">{c.evidence}</span>
              </div>
            ))}
          </div>
        </Spec>

        <Spec title="Funding">
          <div className="cl-funding">
            <span className="cl-funding__status">{s.funding.status}</span>
            <span className="cl-funding__evidence">{s.funding.evidence}</span>
            <span className="cl-funding__co">Co-investors: {s.funding.coInvestors}</span>
          </div>
        </Spec>

        <Spec title="Fit and team">
          <div className="cl-fitteam">
            <div className="cl-col">
              {s.fitRows.map((r) => <Bar key={r.key} r={r} fill="#1d1d1f" />)}
            </div>
            <div className="cl-col">
              {s.teamRows.map((r) => <Bar key={r.key} r={r} fill="#0a6e99" />)}
            </div>
            <span className="cl-fitteam__note">
              Every point links to the trace and the sentence it came from. “Not known” means the sources say nothing yet.
              Germany is a hard rule in the HTGF check, so it scores no points here.
              {s.antiSignals.length > 0 && ` Points off: ${s.antiSignals.join(", ")}.`}
              {s.teamReason && ` Team: ${s.teamReason}`}
            </span>
          </div>
        </Spec>

        <Spec title="Deep checks" aside={s.deep.when}>
          <div>
            {s.deep.checked ? (
              <div className="cl-deep">
                {s.deep.items.map((d) => (
                  <div key={d.label} className="cl-deep__item">
                    <span className="cl-deep__head"><span className="cl-deep__label">{d.label}</span><span style={{ color: d.ink, fontWeight: 600 }}>{d.value}</span></span>
                    <span className="cl-deep__note">{d.note}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="cl-notchecked">Not checked yet. Flight risk, IP, competitors, Series A risk and an intro path appear after the next deep-check run.</p>
            )}
          </div>
        </Spec>

        <Spec title="Sources" aside={s.sources.line}>
          <div className="cl-sources">
            {s.sources.quotes.map((q) => <blockquote key={q}>{q}</blockquote>)}
            {s.sources.quotes.length === 0 && <p className="cl-days__text">No quotes in the traces yet.</p>}
            {s.sources.matches.map((m) => (
              <span key={m.id} className="cl-muted13">
                {m.url ? <a href={m.url} target="_blank" rel="noreferrer">{m.id}</a> : m.id}, {m.how}
              </span>
            ))}
            {s.sources.type && <span className="cl-muted13">{s.sources.type}</span>}
          </div>
        </Spec>
      </div>

      <div className="cl-actions">
        <button type="button" className="ff-btn cl-btn22" onClick={() => feedback.vote(s.key, "up")}>Good lead</button>
        <button type="button" className="ff-btn ff-btn--secondary cl-btn22" onClick={() => feedback.vote(s.key, "down")}>Not a fit</button>
        <span className="cl-muted13" role="status">{feedback.note[s.key] || "Your vote tunes the weights."}</span>
      </div>
    </article>
  );
}

export default function CallList({ intro, rows, details, memos, asOf, initial = 0, source, snapshot }) {
  const [sel, setSel] = useState(initial < rows.length ? initial : 0);
  const briefing = useBriefing();
  const feedback = useFeedback();
  const s = details[sel];
  return (
    <main className="cl-main">
      <section className="cl-top">
        <div className="cl-top__text">
          <h1>Today’s call list.</h1>
          <p>{intro}</p>
        </div>
        <div className="cl-top__buttons">
          <button type="button" className="ff-btn" onClick={briefing.play} disabled={briefing.busy}>Play the briefing</button>
          <button type="button" className="ff-btn ff-btn--secondary" onClick={() => memos[sel] && downloadMemo(memos[sel], asOf, false)} disabled={!memos[sel]}>Export memo</button>
        </div>
      </section>
      <p className="ff-source cl-source" role="status">
        {[briefing.note, snapshot ? source : ""].filter(Boolean).join(" ")}
      </p>

      {rows.length === 0 ? (
        <p className="cl-empty">No team is on the call list right now. Teams appear here when they pass every HTGF gate and clear the bar on tech depth, fit and team.</p>
      ) : (
        <div className="cl-layout">
          <section aria-label="Leads" className="cl-list">
            {rows.map((row, i) => <Row key={row.key} row={row} selected={i === sel} onPick={() => setSel(i)} />)}
          </section>
          {s && <Detail s={s} feedback={feedback} />}
        </div>
      )}
    </main>
  );
}
