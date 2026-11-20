import { notFound } from "next/navigation";
import fixture from "@/data/proof-leads.json";
import ProfileHeader from "../../profile-header";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const sources = {
  campus: "University",
  github: "GitHub",
  huggingface: "Hugging Face",
  luma: "Luma event",
  recording: "Pitch recording",
};

export function generateStaticParams() {
  return fixture.leads.map(({ id }) => ({ id }));
}

async function getLead(params) {
  const { id } = await params;
  const lead = fixture.leads.find((entry) => entry.id === id);
  if (!lead) notFound();
  return lead;
}

export async function generateMetadata({ params }) {
  const lead = await getLead(params);
  return { title: `${lead.name} | Founders First demo` };
}

export default async function SavedCandidateProfile({ params }) {
  const lead = await getLead(params);

  return (
    <main className="candidate-shell candidate-main candidate-profile">
      <ProfileHeader
        company={{ ...lead, location: lead.city }}
        label="Fictional demo candidate"
      />
      <section className="candidate-about" aria-labelledby="demo-about">
        <h2 id="demo-about">What they do</h2>
        <p>{lead.what}</p>
      </section>
      <section className="candidate-about" aria-labelledby="demo-screening">
        <h2 id="demo-screening">Screening snapshot</h2>
        <dl className="candidate-metrics">
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
        </dl>
        <p>
          <strong>Stage:</strong> {lead.stage}
        </p>
        <p>{lead.label_reason}</p>
        <dl className="candidate-fitBreakdown candidate-fitEvidence">
          <div>
            <dt>Why the demo fit score?</dt>
            <dd>
              <p>{lead.fit_reason}</p>
            </dd>
          </div>
          <div>
            <dt>Why the demo team score?</dt>
            <dd>
              <p>{lead.team_reason}</p>
            </dd>
          </div>
        </dl>
        <p>
          These ratings use fictional data.{" "}
          <a href="#demo-evidence">See the sample traces.</a>
        </p>
      </section>
      <section className="candidate-about" aria-labelledby="demo-team">
        <h2 id="demo-team">Team</h2>
        <ul className="candidate-profileList">
          {lead.people.map(({ name, role }) => (
            <li key={name}>
              <strong>{name}</strong>
              <p>{role}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="candidate-about" aria-labelledby="demo-evidence">
        <h2 id="demo-evidence">Illustrative evidence</h2>
        <ul className="candidate-profileList">
          {lead.signals.map((signal) => (
            <li key={signal.trace_id}>
              <strong>{sources[signal.kind] ?? signal.kind}</strong>
              <span>
                {" "}
                ·{" "}
                <time dateTime={signal.happened_at}>
                  {dateFormatter.format(new Date(signal.happened_at))}
                </time>
              </span>
              {signal.timestamp && <span> · {signal.timestamp}</span>}
              {signal.quote && <p>“{signal.quote}”</p>}
              {signal.url && (
                <a className="candidate-source" href={signal.url}>
                  View source
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
