"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { publishDemoRun } from "../demo-workflow";
import {
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
  const ranked = [...qualified].sort(
    (a, b) => b.fit_score - a.fit_score || b.team_score - a.team_score,
  );
  return [
    {
      title: "Find public traces",
      Icon: ScanSearch,
      description: "Read every trace found in the simulated search.",
      unit: "traces",
      delay: 330,
      events: traces.map((signal) => ({
        id: signal.trace_id,
        title: signal.company,
        note: sourceNames[signal.kind] ?? signal.kind,
        outcome: "Found",
        signal,
      })),
    },
    {
      title: "Group by team",
      Icon: Layers3,
      description: "Combine related traces so each team appears once.",
      unit: "teams",
      delay: 360,
      events: leads.map((lead) => ({
        id: lead.id,
        title: lead.name,
        note: `${lead.signals.length} linked ${lead.signals.length === 1 ? "trace" : "traces"}`,
        outcome: "Grouped",
        lead,
      })),
    },
    {
      title: "Screen for VC relevance",
      Icon: SlidersHorizontal,
      description:
        "Keep product-led teams and screen out agencies, coursework and hobby projects.",
      unit: "teams",
      delay: 480,
      events: leads.map((lead) => {
        const kept = lead.label === "vc_backable";
        return {
          id: lead.id,
          title: lead.name,
          note: kept
            ? lead.label_reason
            : `${labels[lead.label] ?? lead.label} · ${lead.label_reason}`,
          outcome: kept ? "Passed screening" : "Filtered out",
          excluded: !kept,
          lead,
        };
      }),
    },
    {
      title: "Prepare review queue",
      Icon: Target,
      description: `The demo prioritizes teams with at least ${criteria.sources} sources, fit of ${criteria.fit}/100 or higher, and team strength of ${criteria.team}/100 or higher.`,
      unit: "candidates",
      delay: 520,
      events: ranked.map((lead) => {
        const reason = shortlistReason(lead);
        return {
          id: lead.id,
          title: lead.name,
          note:
            reason ||
            `Fit ${lead.fit_score}/100 · Team ${lead.team_score}/100 · ${lead.source_count} sources`,
          outcome: reason ? "Filtered out" : "Ready for review",
          excluded: Boolean(reason),
          lead,
        };
      }),
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

function Candidate({ event }) {
  const { lead, outcome, note, excluded } = event;
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
          <span className="search-outcome" data-excluded={!!excluded}>
            {outcome}
          </span>
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
        <h3>Step outcome</h3>
        <p>{note}</p>
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
  const [stages] = useState(() => makeStages(leads));
  const [run, setRun] = useState(null);
  const [paused, setPaused] = useState(false);
  const [viewed, setViewed] = useState(null);
  const finished = run?.stage === stages.length;
  const running = Boolean(run && !finished);
  const currentStage = running ? stages[run.stage] : null;
  const seen = run?.seen;

  useEffect(() => {
    if (!currentStage || paused) return;
    const timer = setTimeout(
      () => {
        setRun(({ stage, seen }) =>
          seen === currentStage.events.length
            ? { stage: stage + 1, seen: 0 }
            : { stage, seen: seen + 1 },
        );
      },
      seen === currentStage.events.length ? 1200 : currentStage.delay,
    );
    return () => clearTimeout(timer);
  }, [currentStage, paused, seen]);

  function start() {
    setViewed(null);
    setPaused(false);
    setRun({ stage: 0, seen: 0 });
  }

  function visibleEvents(index) {
    const events = stages[index].events;
    return index < run.stage ? events : events.slice(0, run.seen);
  }

  const activeIndex = run ? Math.min(run.stage, stages.length - 1) : 0;
  const stageIndex = viewed ?? activeIndex;
  const stage = stages[stageIndex];
  const events = run ? visibleEvents(stageIndex) : [];
  const kept = events.filter((event) => !event.excluded);
  const excluded = events.filter((event) => event.excluded);
  const latest =
    run &&
    (visibleEvents(activeIndex).at(-1) ??
      stages[activeIndex - 1]?.events.at(-1));
  const reviewQueue = stages.at(-1).events.filter((event) => !event.excluded);

  useEffect(() => {
    if (finished)
      publishDemoRun(
        stages
          .at(-1)
          .events.filter((event) => !event.excluded)
          .map((event) => event.id),
      );
  }, [finished, stages]);

  return (
    <main className="candidate-shell candidate-main search-demo">
      <header className="candidate-intro search-intro">
        <div>
          <p className="candidate-kicker">Simulated search · Fictional data</p>
          <h1>Startup search</h1>
          <p>
            Follow a Munich search from the first public trace to a queue of
            teams ready for VC review.
          </p>
        </div>
        <div className="search-controls">
          <button
            type="button"
            className="search-start"
            onClick={start}
            disabled={running}
          >
            <Radar size={19} aria-hidden="true" />
            {running
              ? "Trace in progress"
              : finished
                ? "Run again"
                : "Initiate trace"}
          </button>
          {running && (
            <button
              type="button"
              className="search-pause"
              onClick={() => setPaused(!paused)}
            >
              {paused ? "Resume" : "Pause"}
            </button>
          )}
        </div>
      </header>

      {run ? (
        <section className="search-activity" aria-label="Trace activity">
          <div className="search-activityTitle">
            <span
              className="search-activityDot"
              data-running={running && !paused}
            />
            <p role="status">
              {finished
                ? `Trace complete · ${reviewQueue.length} teams ready for review`
                : `${paused ? "Paused" : "Running"} · Step ${activeIndex + 1} of ${stages.length} · ${currentStage.title}`}
            </p>
          </div>
          {finished && (
            <Link className="search-reviewLink" href="/proof/demo">
              Review teams in Sourcing demo
            </Link>
          )}
          {latest && !finished && (
            <p className="search-latest" data-excluded={!!latest.excluded}>
              <strong>{latest.outcome}</strong> · {latest.title}{" "}
              <span>· {latest.note}</span>
            </p>
          )}
        </section>
      ) : (
        <p className="search-status">
          Initiate the trace to see findings and filtering decisions as they
          appear.
        </p>
      )}

      <ol className="search-steps" aria-label="Search stages">
        {stages.map(({ title, Icon, unit }, index) => {
          const done = Boolean(run && index < run.stage);
          const active = running && index === run.stage;
          const available = done || active;
          const rows = available ? visibleEvents(index) : [];
          const count = rows.filter((event) => !event.excluded).length;
          return (
            <li
              key={title}
              data-state={done ? "complete" : active ? "running" : "waiting"}
            >
              <button
                type="button"
                disabled={!available}
                aria-pressed={available && stageIndex === index}
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
                  {available ? `${count} ${unit}` : "Waiting"}
                  {rows.length > count && (
                    <small>{rows.length - count} filtered out</small>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {run && (
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
            {running && viewed !== null && (
              <button
                type="button"
                className="search-follow"
                onClick={() => setViewed(null)}
              >
                Follow live
              </button>
            )}
          </header>
          {!events.length && (
            <p className="search-empty">Waiting for the first result…</p>
          )}
          {stageIndex === 0 && events.length > 0 && (
            <ul className="search-signals" aria-label="Initial traces">
              {events.map(({ id, signal }) => (
                <Signal key={id} signal={signal} />
              ))}
            </ul>
          )}
          {stageIndex > 0 && kept.length > 0 && (
            <div className="search-candidates" aria-label="Teams kept">
              {kept.map((event) => (
                <Candidate key={event.id} event={event} />
              ))}
            </div>
          )}
          {excluded.length > 0 && (
            <div className="search-excluded">
              <h3>{excluded.length} filtered out</h3>
              <div className="search-candidates">
                {excluded.map((event) => (
                  <Candidate key={event.id} event={event} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
