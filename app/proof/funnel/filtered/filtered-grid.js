"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import BringToFront from "@/components/ff/bring-to-front";

// Cards for the filtered page. Everything shown arrives prepared by lib/screen/filtered.js; this file only sorts,
// searches and pages (24 at first) and renders.

const PAGE = 24;

function Stats({ stats }) {
  return (
    <dl className="fl-stats">
      {stats.map((s) => (
        <div key={s.label} className="fl-stat">
          <dt>{s.label}</dt>
          <dd>
            {s.ring !== undefined && s.ring !== null ? (
              <span className="fl-ring" style={{ background: `conic-gradient(#1d1d1f ${Math.round(s.ring * 3.6)}deg, #eef1f6 0deg)` }} role="img" aria-label={`${s.label} ${s.value} of 100`}>
                <span aria-hidden="true">{s.value}</span>
              </span>
            ) : (
              <span className={s.value === "not known" ? "fl-stat__unknown" : undefined}>{s.value}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Footer({ c }) {
  return (
    <div className="fl-foot">
      <Link href={c.href} className="fl-open">Open profile<span className="ff-sr-only">: {c.name}</span></Link>
      <BringToFront leadKey={c.key} bringReason={c.bringReason} candidate={c.isCandidate} name={c.name} />
    </div>
  );
}

export function NearCard({ c }) {
  return (
    <article className="po-tile fl-card fl-card--near" aria-label={c.name}>
      <span className="po-tile__sub">{c.sector}, {c.city}</span>
      <h3 className="fl-name fl-name--near">{c.name}</h3>
      <p className="fl-missed">{c.near.missedBy}</p>
      {c.sentence !== c.near.missedBy && <p className="fl-sentence">{c.sentence}</p>}
      <Stats stats={c.stats} />
      <Footer c={c} />
    </article>
  );
}

function Card({ c }) {
  return (
    <article className="po-tile fl-card" aria-label={c.name}>
      <span className="po-tile__sub">{c.sector}, {c.city}</span>
      <h3 className="fl-name">{c.name}</h3>
      <p className="fl-sentence">{c.sentence}</p>
      <Stats stats={c.stats} />
      <Footer c={c} />
    </article>
  );
}

const SORTS = {
  fit: { label: "Fit, high to low", fn: (a, b) => b.sort.fit - a.sort.fit || a.sort.name.localeCompare(b.sort.name) },
  age: { label: "Age, youngest first", fn: (a, b) => (a.sort.age < 0) - (b.sort.age < 0) || a.sort.age - b.sort.age || a.sort.name.localeCompare(b.sort.name) },
  name: { label: "Name", fn: (a, b) => a.sort.name.localeCompare(b.sort.name) },
};

export default function FilteredGrid({ cards }) {
  const [sort, setSort] = useState("fit");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const sortId = useId();
  const searchId = useId();
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((c) => !q || c.name.toLowerCase().includes(q)).sort(SORTS[sort].fn);
  }, [cards, sort, query]);
  return (
    <section aria-label="Companies" className="fl-grid-wrap">
      <div className="fl-controls">
        <label htmlFor={searchId} className="fl-label">Search by name</label>
        <input id={searchId} type="search" className="fl-input" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} placeholder="Company name" />
        <label htmlFor={sortId} className="fl-label">Sort</label>
        <select id={sortId} className="fl-input fl-select" value={sort} onChange={(e) => setSort(e.target.value)}>
          {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
        <span className="fl-count" role="status">{list.length} {list.length === 1 ? "company" : "companies"}</span>
      </div>
      {list.length === 0 ? (
        <p className="fl-empty">No company matches “{query}”.</p>
      ) : (
        <div className="fl-grid">
          {list.slice(0, limit).map((c) => <Card key={c.key} c={c} />)}
        </div>
      )}
      {list.length > limit && (
        <button type="button" className="ff-btn ff-btn--secondary fl-more" onClick={() => setLimit((n) => n + PAGE)}>
          Show more ({list.length - limit} left)
        </button>
      )}
    </section>
  );
}
