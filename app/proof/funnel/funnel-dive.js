"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

// The funnel beam with the drop-out dive (DESIGN.md, "Funnel dive"). Stages from "Past the HTGF gates" down are
// buttons; opening one splits its beam (the drop-outs leave on the right as ion dots, one per company, capped at 60)
// and opens the panel under the funnel. One stage at a time, Esc or the close button closes it, ?stage=<key> in the URL.
// All numbers and groups arrive prepared by lib/screen/funnel.js (honestFunnel).

const MAX_DOTS = 60;
const SHOWN = 8;

function Dots({ n }) {
  const count = Math.min(n, MAX_DOTS);
  return (
    <span className="fd-dots" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="fd-dot" style={{ "--i": i, "--row": i % 4 }} />
      ))}
      {n > MAX_DOTS && <span className="fd-more">+{n - MAX_DOTS}</span>}
    </span>
  );
}

function Group({ g }) {
  const [all, setAll] = useState(false);
  const rows = all ? g.rows : g.rows.slice(0, SHOWN);
  return (
    <div className="fd-group">
      <div className="fd-group__head">
        <h3>{g.reason}</h3>
        <span className="fd-group__n">{g.n}</span>
      </div>
      <span className="fd-group__bar" aria-hidden="true"><span style={{ width: `${g.pct}%` }} /></span>
      <ul className="fd-rows">
        {rows.map((r) => (
          <li key={r.key}>
            <Link href={r.href} className="fd-row">
              <span className="fd-row__name">{r.name}</span>
              <span className="fd-row__city">{r.city}</span>
              <span className="fd-row__why">{r.why}</span>
              <span className="fd-row__fit">{r.fit}</span>
            </Link>
          </li>
        ))}
      </ul>
      {g.rows.length > SHOWN && (
        <button type="button" className="fd-showall" onClick={() => setAll((a) => !a)} aria-expanded={all}>
          {all ? "Show fewer" : `Show all ${g.n}`}
        </button>
      )}
    </div>
  );
}

export default function FunnelDive({ stages, lowerFrom, initialStage }) {
  const valid = (k) => stages.some((s) => s.key === k && s.dive);
  const [open, setOpen] = useState(valid(initialStage) ? initialStage : null);
  const buttons = useRef({});
  const panel = useRef(null);

  const select = useCallback((key) => {
    setOpen(key);
    const url = new URL(window.location.href);
    if (key) url.searchParams.set("stage", key);
    else url.searchParams.delete("stage");
    window.history.replaceState(null, "", url);
  }, []);

  const close = useCallback(() => {
    const was = open;
    select(null);
    if (was) buttons.current[was]?.focus();
  }, [open, select]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const active = stages.find((s) => s.key === open);
  return (
    <>
      <section aria-label="Stages" className="fu-stages">
        {stages.map((s, i) => {
          const diveable = i >= lowerFrom && s.dive;
          const isOpen = open === s.key;
          const beam = (
            <span className="fu-stage__beam">
              <span className={`fd-beam${isOpen ? " fd-beam--open" : ""}`} style={{ width: `${s.pct}%`, background: s.color, boxShadow: s.glow, color: s.ink, "--drop": `${s.dropPct || 0}%` }}>
                {s.n}
                {isOpen && <Dots n={s.dive.count} />}
              </span>
            </span>
          );
          return diveable ? (
            <button
              key={s.label}
              type="button"
              ref={(el) => { buttons.current[s.key] = el; }}
              className={`fu-stage fd-stage${isOpen ? " fd-stage--open" : ""}`}
              aria-expanded={isOpen}
              aria-controls="funnel-dive"
              aria-label={`${s.label}, ${s.n}. ${isOpen ? "Close" : "Show"} the ${s.dive.count} that stopped before ${s.next.charAt(0).toLowerCase()}${s.next.slice(1)}`}
              onClick={() => (isOpen ? close() : select(s.key))}
            >
              <span className="fu-stage__label">{s.label}</span>
              {beam}
              <span className="fu-stage__cost">{s.cost}</span>
            </button>
          ) : (
            <div key={s.label} className="fu-stage">
              <span className="fu-stage__label">{s.label}</span>
              {beam}
              <span className="fu-stage__cost">{s.cost}</span>
            </div>
          );
        })}
      </section>

      <div id="funnel-dive" ref={panel} className="fd-panel" hidden={!active} role="region" aria-label={active?.dive?.title || "Drop-outs"}>
        {active?.dive && (
          <div className="fd-panel__inner" key={active.key}>
            <div className="fd-panel__head">
              <h2>{active.dive.title}</h2>
              <button type="button" className="ff-btn fd-close" onClick={close}>Close</button>
            </div>
            {active.dive.groups.map((g) => <Group key={g.reason} g={g} />)}
          </div>
        )}
      </div>
    </>
  );
}
