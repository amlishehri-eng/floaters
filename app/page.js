import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  Code2,
  GraduationCap,
  Mic,
  Radar,
} from "lucide-react";
import fixture from "@/data/proof-leads.json";
import "./home.css";

export const metadata = {
  title: "Founders First | Early startup discovery",
  description:
    "Explore early startup signals from Munich’s universities, developer communities, and pitch events.",
};

const sources = [
  {
    Icon: GraduationCap,
    title: "University research",
    description:
      "Find teams through grants, incubator programs, and university spinouts.",
  },
  {
    Icon: Code2,
    title: "Developer communities",
    description:
      "Track public code releases and prototypes on GitHub and Hugging Face.",
  },
  {
    Icon: Mic,
    title: "Pitch events",
    description:
      "See what founders share at demo days and in recorded pitches.",
  },
];

export default function Home() {
  const example = fixture.leads[0];

  return (
    <div className="home-site">
      <header className="home-header">
        <div className="home-shell home-nav">
          <Link className="home-brand" href="/">
            <Radar size={24} aria-hidden="true" />
            Founders First
          </Link>
          <nav aria-label="Main navigation">
            <a className="home-methodLink" href="#how-it-works">
              How it works
            </a>
            <Link className="home-action home-actionDark" href="/proof">
              Analytics <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>
      <main className="home-shell">
        <section className="home-hero">
          <h1>
            Find founders
            <br /> <span>before the headlines.</span>
          </h1>
          <p>
            Discover emerging Munich startups through the public signals their
            founders leave behind.
          </p>
          <div className="home-heroActions">
            <Link className="home-action home-actionPrimary" href="/proof">
              Explore analytics <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <a className="home-action" href="#how-it-works">
              How it works <ArrowDown size={16} aria-hidden="true" />
            </a>
          </div>
        </section>
        <section className="home-preview" aria-labelledby="preview-title">
          <div className="home-previewCopy">
            <h2 id="preview-title">
              From early signals to a lead you can evaluate.
            </h2>
            <p>
              See which sources surfaced a team, how it ranks for HTGF fit, and
              when its earliest signal appeared.
            </p>
          </div>
          <Link href="/proof" className="home-previewCard">
            <div className="home-cardHeader">
              <span>Example lead</span>
              <span className="home-exampleLabel">Fictional data</span>
            </div>
            <div className="home-cardTitle">
              <span className="home-signalIcon">
                <Radar size={24} aria-hidden="true" />
              </span>
              <div>
                <h3>{example.name}</h3>
                <p>
                  {example.sector} · {example.city}
                </p>
              </div>
            </div>
            <p className="home-cardDescription">{example.what}</p>
            <dl>
              <div>
                <dt>HTGF fit</dt>
                <dd>
                  {example.fit_score}
                  <span>/100</span>
                </dd>
              </div>
              <div>
                <dt>Team score</dt>
                <dd>
                  {example.team_score}
                  <span>/100</span>
                </dd>
              </div>
              <div>
                <dt>Sources</dt>
                <dd>{example.source_count}</dd>
              </div>
            </dl>
            <span className="home-previewLink">
              View lead explorer <ArrowRight size={16} aria-hidden="true" />
            </span>
          </Link>
        </section>
        <section
          className="home-method"
          id="how-it-works"
          aria-labelledby="method-title"
        >
          <h2 id="method-title">Where we look</h2>
          <p>
            When the same people appear across multiple sources, the dashboard
            brings those signals together so you can evaluate the team.
          </p>
          <ul>
            {sources.map(({ Icon, title, description }) => (
              <li key={title}>
                <Icon size={25} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <footer className="home-shell home-footer">
        <span>Founders First · HTGF hackathon prototype</span>
        <Link href="/proof">
          Analytics <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </footer>
    </div>
  );
}
