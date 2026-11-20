"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Activity,
  Bookmark,
  Check,
  Download,
  Layers,
  MapPin,
  Radar,
  Search,
  Target,
  Users,
} from "lucide-react";
import "./proof.css";

const funnelIcons = [Activity, Users, Layers, Target];
const sourceNames = {
  campus: "Campus",
  github: "GitHub",
  huggingface: "Hugging Face",
  recording: "Pitch recording",
  luma: "Luma",
  eventbrite: "Eventbrite",
};

function sourceCount(count) {
  return `${count} ${count === 1 ? "source" : "sources"}`;
}
const day = 86400000;
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
function date(value) {
  return dateFormatter.format(new Date(value));
}
function timing(lead, asOf) {
  const days = Math.max(
    0,
    Math.floor(
      (Date.parse(lead.first_public_at || asOf) -
        Date.parse(lead.first_trace_at)) /
        day,
    ),
  );
  return lead.first_public_at
    ? `${days} days ahead`
    : `${days} days since first trace`;
}
function worthCalling(lead) {
  return (
    lead.label === "vc_backable" &&
    lead.fit_score >= 80 &&
    lead.team_score >= 80 &&
    lead.source_count >= 2
  );
}
function Score({ label, score, reason }) {
  return (
    <div className="proof-score">
      <div>
        <span>{label}</span>
        <strong>
          {score}
          <small>/100</small>
        </strong>
      </div>
      <progress max="100" value={score} aria-label={label} />
      <p>{reason}</p>
    </div>
  );
}
function downloadMemo(lead, asOf) {
  const memo = [
    `# ${lead.name}`,
    "",
    "FICTIONAL DEMO DATA — not a verified startup discovery.",
    "",
    lead.what,
    "",
    `Location: ${lead.city}, ${lead.country}`,
    `Sector: ${lead.sector}`,
    `Stage: ${lead.stage}`,
    `HTGF fit: ${lead.fit_score}/100 — ${lead.fit_reason}`,
    `Team: ${lead.team_score}/100 — ${lead.team_reason}`,
    "",
    "## People",
    ...lead.people.map((person) => `- ${person.name} — ${person.role}`),
    "",
    "## Evidence",
    ...[...lead.signals]
      .sort((a, b) => a.happened_at.localeCompare(b.happened_at))
      .map(
        (signal) =>
          `- ${signal.happened_at} · ${signal.kind}${signal.timestamp ? ` · ${signal.timestamp}` : ""}: ${signal.quote}${signal.url ? ` (${signal.url})` : ""}`,
      ),
    "",
    `Timing as of ${asOf}: ${timing(lead, asOf)}.`,
    lead.first_public_at
      ? `Public benchmark: ${lead.first_public_at} (illustrative).`
      : "No public benchmark is supplied in this fixture. Visibility and funding status require verification.",
    "",
    "## Before presenting",
    "Verify the team, activity, funding status, source links and dates. Identify a public professional introduction route.",
  ].join("\n");
  const url = URL.createObjectURL(
    new Blob([memo], {
      type: "text/markdown;charset=utf-8",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${lead.id}-memo.md`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function ProofDashboard({ leads, asOf }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("vc_backable");
  const [sector, setSector] = useState("");
  const [invisibleOnly, setInvisibleOnly] = useState(false);
  const [sort, setSort] = useState("fit_score");
  const [selectedId, setSelectedId] = useState(leads[0]?.id);
  const [shortlist, setShortlist] = useState([]);
  const sectors = [...new Set(leads.map((lead) => lead.sector))].sort();
  const visible = leads
    .filter((lead) => {
      const matchesQuery = [
        lead.name,
        lead.what,
        lead.sector,
        ...lead.people.map((person) => person.name),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase());
      const matchesFilter =
        filter === "all" ||
        (filter === "shortlist"
          ? shortlist.includes(lead.id)
          : lead.label === filter);
      return (
        matchesQuery &&
        matchesFilter &&
        (!sector || lead.sector === sector) &&
        (!invisibleOnly || !lead.first_public_at)
      );
    })
    .sort(
      (a, b) =>
        b[sort] - a[sort] ||
        b.fit_score - a.fit_score ||
        b.team_score - a.team_score ||
        b.source_count - a.source_count ||
        a.name.localeCompare(b.name),
    );
  const selected = visible.find((lead) => lead.id === selectedId) || visible[0];
  const eligible = leads.filter((lead) => lead.label === "vc_backable");
  const traceCount = leads.reduce(
    (total, lead) => total + lead.signals.length,
    0,
  );
  const funnel = [
    ["Traces found", traceCount],
    ["Teams identified", leads.length],
    ["VC potential", eligible.length],
    ["Worth a call", leads.filter(worthCalling).length],
  ];
  function toggleShortlist(id) {
    setShortlist((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }
  return (
    <main className="proof-app">
      <aside className="proof-sidebar">
        <Link
          href="/"
          className="proof-brand"
          aria-label="Founders First homepage"
        >
          <Radar size={28} />
          <span>
            Founders <strong>First</strong>
          </span>
        </Link>
        <nav aria-label="Workspace">
          <a className="proof-activeNav" href="#leads">
            <Layers size={17} /> Lead explorer
          </a>
          <a href="#proof">
            <ArrowUpRight size={17} /> Demo readiness
          </a>
        </nav>
        <div className="proof-sidebarBottom">
          <span className="proof-locationDot" /> Munich, Germany
          <p>HTGF track · Hackathon</p>
        </div>
      </aside>
      <div className="proof-workspace">
        <header className="proof-topbar">
          <Link href="/" className="proof-topbarLabel">
            <Radar size={17} aria-hidden="true" /> Founders First
          </Link>
          <span
            className="proof-demoBadge"
            title="All teams and evidence shown are fictional"
          >
            Fictional demo data
          </span>
        </header>
        <div className="proof-content">
          <section className="proof-heading">
            <div>
              <h1>Startup discovery</h1>
              <p>
                Find emerging Munich startups through signals from universities,
                developer communities and pitch events.
              </p>
            </div>
            <div className="proof-scope">
              <MapPin size={17} />
              <span>
                Munich ecosystem<small>Snapshot · {date(asOf)}</small>
              </span>
            </div>
          </section>
          <section aria-label="Sourcing funnel" className="proof-funnel">
            {funnel.map(([label, count], index) => {
              const Icon = funnelIcons[index];
              return (
                <div key={label}>
                  <span className="proof-metricIcon">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </div>
                </div>
              );
            })}
          </section>
          <p className="proof-threshold">
            Worth a call = VC potential, fit and team scores ≥80, and at least
            two sources.
          </p>
          <section id="leads" className="proof-explorer">
            <div className="proof-sectionHeading">
              <h2>Lead explorer</h2>
              <button
                className="proof-shortcut"
                aria-pressed={filter === "shortlist"}
                onClick={() =>
                  setFilter(
                    filter === "shortlist" ? "vc_backable" : "shortlist",
                  )
                }
              >
                <Bookmark size={16} aria-hidden="true" /> Shortlist (
                {shortlist.length})
              </button>
            </div>
            <div className="proof-toolbar">
              <label className="proof-search">
                <Search size={17} />
                <input
                  aria-label="Search leads"
                  placeholder="Search teams, people or sectors"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <label className="proof-select">
                Show
                <select
                  aria-label="Lead category"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  <option value="vc_backable">VC potential</option>
                  <option value="all">All teams</option>
                  <option value="shortlist">
                    Shortlist ({shortlist.length})
                  </option>
                  <option value="agency">Agencies</option>
                  <option value="assignment">Assignments</option>
                  <option value="hobby">Hobby projects</option>
                </select>
              </label>
              <label className="proof-select">
                <select
                  aria-label="Sector"
                  value={sector}
                  onChange={(event) => setSector(event.target.value)}
                >
                  <option value="">All sectors</option>
                  {sectors.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="proof-check">
                <input
                  type="checkbox"
                  checked={invisibleOnly}
                  onChange={(event) => setInvisibleOnly(event.target.checked)}
                />
                Still invisible
              </label>
            </div>
            <div className="proof-split">
              <div className="proof-listPanel">
                <div className="proof-listHeader">
                  <span aria-live="polite">
                    {visible.length} {visible.length === 1 ? "team" : "teams"}
                  </span>
                  <label>
                    <ArrowDown size={13} />
                    <select
                      aria-label="Sort leads"
                      value={sort}
                      onChange={(event) => setSort(event.target.value)}
                    >
                      <option value="fit_score">HTGF fit</option>
                      <option value="team_score">Team score</option>
                      <option value="source_count">Source count</option>
                    </select>
                  </label>
                </div>
                <div className="proof-leadList">
                  {visible.map((lead) => (
                    <button
                      key={lead.id}
                      className={`proof-leadRow ${selected?.id === lead.id ? "proof-selected" : ""}`}
                      aria-pressed={selected?.id === lead.id}
                      onClick={() => setSelectedId(lead.id)}
                    >
                      <div className="proof-rowTop">
                        <span className="proof-monogram">
                          {lead.name.slice(0, 1)}
                        </span>
                        <div className="proof-rowIdentity">
                          <strong>{lead.name}</strong>
                          <small>{lead.sector}</small>
                        </div>
                        <span className="proof-rowScore">
                          {lead[sort]}
                          <small>
                            {
                              {
                                fit_score: "Fit",
                                team_score: "Team",
                                source_count: "Sources",
                              }[sort]
                            }
                          </small>
                        </span>
                      </div>
                      <p>{lead.what}</p>
                      <div className="proof-rowMeta">
                        <span>{sourceCount(lead.source_count)}</span>
                        <span
                          className="proof-status"
                          data-public={Boolean(lead.first_public_at)}
                        >
                          {lead.first_public_at
                            ? "Public mention"
                            : "Still invisible"}
                        </span>
                        {shortlist.includes(lead.id) && (
                          <Check size={14} aria-label="Shortlisted" />
                        )}
                      </div>
                    </button>
                  ))}
                  {!visible.length && (
                    <div className="proof-empty">
                      <Search size={24} />
                      <h3>No matching teams</h3>
                      <p>Try another search or clear your filters.</p>
                      <button
                        onClick={() => {
                          setQuery("");
                          setFilter("all");
                          setSector("");
                          setInvisibleOnly(false);
                        }}
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {selected ? (
                <article className="proof-detail" aria-label="Selected lead">
                  <div className="proof-detailTop">
                    <span className="proof-sector">{selected.sector}</span>
                    <span
                      className="proof-status"
                      data-public={Boolean(selected.first_public_at)}
                    >
                      {selected.first_public_at
                        ? "Public mention found"
                        : "Still invisible"}
                    </span>
                  </div>
                  <h2>{selected.name}</h2>
                  <p className="proof-description">{selected.what}</p>
                  <div className="proof-detailMeta">
                    <span>
                      <MapPin size={14} />
                      {selected.city}, {selected.country}
                    </span>
                    <span>{selected.stage}</span>
                    <span>{sourceCount(selected.source_count)}</span>
                  </div>
                  <div className="proof-timing">
                    <Radar size={20} />
                    <div>
                      <strong>{timing(selected, asOf)}</strong>
                      <p>
                        {selected.first_public_at
                          ? `Illustrative benchmark · ${date(selected.first_public_at)}`
                          : "No public benchmark supplied. Funding status is unverified."}
                      </p>
                    </div>
                  </div>
                  <div className="proof-scores">
                    <Score
                      label="HTGF fit"
                      score={selected.fit_score}
                      reason={selected.fit_reason}
                    />
                    <Score
                      label="Team strength"
                      score={selected.team_score}
                      reason={selected.team_reason}
                    />
                  </div>
                  <section className="proof-people">
                    <h3>
                      <Users size={16} />
                      The people
                    </h3>
                    {selected.people.map((person) => (
                      <div key={person.name}>
                        <strong>{person.name}</strong>
                        <span>{person.role}</span>
                      </div>
                    ))}
                  </section>
                  <section className="proof-evidence">
                    <h3>
                      Signals over time <span>{selected.signals.length}</span>
                    </h3>
                    <ol>
                      {[...selected.signals]
                        .sort((a, b) =>
                          a.happened_at.localeCompare(b.happened_at),
                        )
                        .map((signal) => (
                          <li
                            key={signal.trace_id}
                            data-source={signal.source || signal.kind}
                          >
                            <div className="proof-signalHeading">
                              <strong>
                                {sourceNames[signal.source || signal.kind] ||
                                  signal.kind}
                              </strong>
                              <time dateTime={signal.happened_at}>
                                {date(signal.happened_at)}
                              </time>
                            </div>
                            <blockquote>“{signal.quote}”</blockquote>
                            <div className="proof-signalFooter">
                              {signal.timestamp && (
                                <span>Recording · {signal.timestamp}</span>
                              )}
                              {signal.url ? (
                                <a
                                  href={signal.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  View source <ArrowUpRight size={13} />
                                </a>
                              ) : (
                                <span>
                                  Illustrative evidence · source pending
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                    </ol>
                  </section>
                  <p className="proof-classification">
                    <strong>{selected.label.replaceAll("_", " ")}</strong> ·{" "}
                    {selected.label_reason}
                  </p>
                  <div className="proof-actions">
                    <button
                      className="proof-primary"
                      aria-pressed={shortlist.includes(selected.id)}
                      onClick={() => toggleShortlist(selected.id)}
                    >
                      {shortlist.includes(selected.id) ? (
                        <Check size={16} />
                      ) : (
                        <Bookmark size={16} />
                      )}
                      {shortlist.includes(selected.id)
                        ? "Shortlisted"
                        : "Add to shortlist"}
                    </button>
                    <button onClick={() => downloadMemo(selected, asOf)}>
                      <Download size={16} />
                      Export memo
                    </button>
                  </div>
                  <p className="proof-sessionNote">
                    Shortlist is saved for this session until the page reloads.
                  </p>
                </article>
              ) : (
                <div className="proof-detail">
                  <h2>Select a team</h2>
                  <p>Matching teams and their evidence will appear here.</p>
                </div>
              )}
            </div>
          </section>
          <section id="proof" className="proof-readiness">
            <div>
              <p className="proof-eyebrow">DEMO READINESS</p>
              <h2>Demo checklist</h2>
            </div>
            <div>
              <h3>Historical backtest</h3>
              <p>
                Pending real evidence. Choose 10–15 HTGF investments, record
                announcement dates, and run earlier traces through the engine
                blind.
              </p>
            </div>
            <div>
              <h3>Your best find</h3>
              <p>
                Shortlist a team, export its memo, then verify its activity,
                funding status and dated source links before presenting.
              </p>
            </div>
          </section>
          <footer className="proof-footer">
            Founders First{" "}
            <span>Public professional signals · Evidence-led sourcing</span>
          </footer>
        </div>
      </div>
    </main>
  );
}
