"use client";

import { useId, useState } from "react";

// Fit and team rows as disclosures (DESIGN.md, "Fit dropdown"): the whole row is a button, clicking opens a panel
// with why it scored that, up to two quotes and "Source: <host>" links. Several rows can be open at once.
// Rows come prepared by lib/screen/call-list.js (bar()); this component only renders.

function Row({ r, fill }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const panelId = `crit-${id}`;
  return (
    <div className="cr-row" data-open={open || undefined}>
      <button type="button" className="cr-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        <span className="cr-head">
          <span className="cr-label">{r.label}</span>
          <span className="cr-shown" style={{ color: r.ink }}>{r.shown}</span>
        </span>
        <span className="cr-track" aria-hidden="true"><span style={{ width: `${r.pct}%`, background: fill }} /></span>
      </button>
      <div id={panelId} className="cr-panel" role="region" aria-label={`Why ${r.label} scored ${r.shown}`} hidden={!open}>
        <div className="cr-panel__inner">
          <p className="cr-why">{r.panel.why}</p>
          {r.panel.quotes.map((q) => <blockquote key={q} className="cr-quote">{q}</blockquote>)}
          {r.panel.sources.map((s) => (
            <a key={s.url} className="cr-source" href={s.url} target="_blank" rel="noreferrer">Source: {s.host}</a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CriteriaRows({ rows, fill }) {
  return (
    <div className="cr-col">
      {rows.map((r) => <Row key={r.key} r={r} fill={fill} />)}
    </div>
  );
}
