"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Layers3,
  Radar,
  ScanSearch,
  SlidersHorizontal,
  Target,
} from "lucide-react";

const criteria = { fit: 80, team: 80, sources: 2 };
const date = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const sourceNames = {
  campus: "University",
  github: "GitHub",
  huggingface: "Hugging Face",
  luma: "Luma event",
  recording: "Pitch recording",
};
const labels = {
  agency: "Agency",
  assignment: "Coursework",
  hobby: "Hobby project",
};

function shortlistReason(lead) {
  const below = [];
  if (lead.fit_score < criteria.fit) below.push(`fit ${lead.fit_score}/100`);
  if (lead.team_score < criteria.team)
    below.push(`team ${lead.team_score}/100`);
  if (lead.source_count < criteria.sources) below.push("only one source");
  return below.length ? `Below the demo threshold: ${below.join(", ")}.` : "";
}

function makeStages(leads) {
  const traces = leads.flatMap((lead) =>
    lead.signals.map((signal) => ({ ...signal, company: lead.name })),
  );
  const qualified = leads.filter((lead) => lead.label === "vc_backable");
  const shortlist = qualified
    .filter((lead) => !shortlistReason(lead))
    .sort((a, b) => b.fit_score - a.fit_score || b.team_score - a.team_score);
  return [
    {
      title: "Find public traces",
      Icon: ScanSearch,
      description:
        "Collect signals from universities, developer communities and pitch events.",
      count: traces.length,
      unit: "traces",
      traces,
    },
    {
      title: "Group by team",
      Icon: Layers3,
      description:
        "Combine related signals so each team appears once in the results.",
      count: leads.length,
      unit: "teams",
      leads,
    },
    {
      title: "Screen for VC relevance",
      Icon: SlidersHorizontal,
      description:
        "Keep teams building a product for a market. Filter out agencies, coursework and hobby projects.",
      count: qualified.length,
      unit: "teams",
      leads: qualified,
      excluded: leads
        .filter((lead) => lead.label !== "vc_backable")
        .map((lead) => ({
          name: lead.name,
          reason: `${labels[lead.label]} · ${lead.label_reason}`,
        })),
    },
    {
      title: "Build the shortlist",
      Icon: Target,
      description: `Prioritize teams with at least ${criteria.sources} sources and both fit and team scores of at least ${criteria.fit}/100 in this demo.`,
      count: shortlist.length,
      unit: "candidates",
      leads: shortlist,
      excluded: qualified
        .filter(shortlistReason)
        .map((lead) => ({ name: lead.name, reason: shortlistReason(lead) })),
    },
  ];
}

function Signal({ signal }) {
  return (
    <li className="search-signal">
      <div>
        <strong>{sourceNames[signal.kind] ?? signal.kind}</strong>
        <time dateTime={signal.happened_at}>
          {date.format(new Date(signal.happened_at))}
        </time>
        {signal.timestamp && <span>{signal.timestamp}</span>}
      </div>
      {signal.company && (
        <p className="search-signalCompany">{signal.company}</p>
      )}
      {signal.quote && <p>“{signal.quote}”</p>}
      {signal.url && <a href={signal.url}>View source</a>}
    </li>
  );
}

function Candidate({ lead }) {
  return (
    <details className="search-candidate">
      <summary>
        <span>
          <strong>{lead.name}</strong>
          <small>
            {lead.sector} · {lead.city}
          </small>
        </span>
        <span className="search-cardMeta">
          <span>{lead.fit_score}/100 fit</span>
          <ChevronDown size={18} aria-hidden="true" />
        </span>
      </summary>
      <div className="search-candidateBody">
        <p>{lead.what}</p>
        <dl className="search-numbers">
          <div>
            <dt>Demo fit</dt>
            <dd>{lead.fit_score}/100</dd>
          </div>
          <div>
            <dt>Team strength</dt>
            <dd>{lead.team_score}/100</dd>
          </div>
          <div>
            <dt>Sources</dt>
            <dd>{lead.source_count}</dd>
          </div>
          <div>
            <dt>Stage</dt>
            <dd>{lead.stage}</dd>
          </div>
        </dl>
        <h3>Screening rationale</h3>
        <p>{lead.label_reason}</p>
        <p>
          {lead.fit_reason} {lead.team_reason}
        </p>
        <h3>Team</h3>
        <ul className="search-people">
          {lead.people.map((person) => (
            <li key={person.name}>
              {person.name} · {person.role}
            </li>
          ))}
        </ul>
        <h3>Evidence</h3>
        <ul className="search-signals">
          {lead.signals.map((signal) => (
            <Signal key={signal.trace_id} signal={signal} />
          ))}
        </ul>
      </div>
    </details>
  );
}

export default function SearchDemo({ leads }) {
  const stages = makeStages(leads);
  const [completed, setCompleted] = useState(0);
  const [running, setRunning] = useState(false);
  const [viewed, setViewed] = useState(null);
  const finished = completed === stages.length;
  const stage = completed ? stages[viewed ?? completed - 1] : null;

  useEffect(() => {
    if (!running || finished) return;
    const timer = setTimeout(() => {
      setCompleted((count) => count + 1);
    }, 1100);
    return () => clearTimeout(timer);
  }, [running, completed, finished]);

  function start() {
    setViewed(null);
    setCompleted(0);
    setRunning(true);
  }

  const inProgress = running && !finished;
  return (
    <main className="candidate-shell candidate-main search-demo">
      <header className="candidate-intro search-intro">
        <div>
          <p className="candidate-kicker">Simulated search · Fictional data</p>
          <h1>Startup search</h1>
          <p>
            Follow a Munich search from public signals to a shortlist a VC can
            review.
          </p>
        </div>
        <button
          type="button"
          className="search-start"
          onClick={start}
          disabled={inProgress}
        >
          <Radar size={19} aria-hidden="true" />
          {inProgress
            ? "Search running"
            : finished
              ? "Run search again"
              : "Start search"}
        </button>
      </header>

      <p role="status" className="search-status">
        {finished
          ? `Search complete · ${stages.at(-1).count} candidates shortlisted`
          : inProgress
            ? `Step ${completed + 1} of ${stages.length} · ${stages[completed].title}`
            : "Start the search to see each step and its results."}
      </p>

      <ol className="search-steps" aria-label="Search stages">
        {stages.map(({ title, Icon, count, unit }, index) => {
          const done = index < completed;
          const active = inProgress && index === completed;
          return (
            <li
              key={title}
              data-state={done ? "complete" : active ? "running" : "waiting"}
            >
              <button
                type="button"
                disabled={!done}
                aria-pressed={done && stage?.title === title}
                onClick={() => setViewed(index)}
              >
                <span className="search-stepIcon">
                  {done ? (
                    <Check size={18} aria-hidden="true" />
                  ) : (
                    <Icon size={18} aria-hidden="true" />
                  )}
                </span>
                <span>
                  <small>Step {index + 1}</small>
                  <strong>{title}</strong>
                </span>
                <span className="search-stepResult">
                  {done ? `${count} ${unit}` : active ? "Running…" : "Waiting"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {stage && (
        <section
          key={stage.title}
          className="search-results"
          aria-labelledby="search-results-title"
        >
          <header>
            <div>
              <h2 id="search-results-title">{stage.title}</h2>
              <p>{stage.description}</p>
            </div>
            <span className="candidate-sector">
              {stage.count} {stage.unit}
            </span>
          </header>
          {stage.traces && (
            <ul className="search-signals">
              {stage.traces.map((signal) => (
                <Signal key={signal.trace_id} signal={signal} />
              ))}
            </ul>
          )}
          {stage.leads && (
            <div className="search-candidates">
              {stage.leads.map((lead) => (
                <Candidate key={lead.id} lead={lead} />
              ))}
            </div>
          )}
          {stage.excluded?.length > 0 && (
            <details className="search-excluded">
              <summary>
                {stage.excluded.length} filtered out{" "}
                <ArrowRight size={15} aria-hidden="true" />
              </summary>
              <ul>
                {stage.excluded.map(({ name, reason }) => (
                  <li key={name}>
                    <strong>{name}</strong>
                    <p>{reason}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
    </main>
  );
}
