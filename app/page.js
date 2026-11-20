import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  Code2,
  GraduationCap,
  MapPin,
  Mic,
  Radar,
} from "lucide-react";
import companies from "@/data/portfolio-examples.json";
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
    signal: "Research grant",
    description:
      "Find teams through grants, incubator programs, and university spinouts.",
  },
  {
    Icon: Code2,
    title: "Developer communities",
    signal: "Code release",
    description:
      "Track public code releases and prototypes on GitHub and Hugging Face.",
  },
  {
    Icon: Mic,
    title: "Pitch events",
    signal: "Founder pitch",
    description:
      "See what founders share at demo days and in recorded pitches.",
  },
];

const featuredCompany = companies.find(
  (company) => company.slug === "proxima-fusion",
);
const announcementDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default function Home() {
  const example = featuredCompany;

  return (
    <div className="home-site">
      <header className="home-header">
        <div className="home-shell home-nav">
          <Link className="home-brand" href="/">
            <span className="home-brandMark">
              <Radar size={19} aria-hidden="true" />
            </span>
            Founders First
          </Link>
          <nav aria-label="Main navigation">
            <a className="home-methodLink" href="#how-it-works">
              How it works
            </a>
            <Link className="home-action home-actionNav" href="/proof">
              Analytics <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>
      <main className="home-shell">
        <section className="home-hero">
          <div className="home-heroCopy">
            <p className="home-market">
              <MapPin size={15} aria-hidden="true" /> Sourcing in Munich
            </p>
            <h1>
              Find founders <span>before the headlines.</span>
            </h1>
            <p className="home-intro">
              Discover emerging startups through the research, code, and pitches
              founders share before they make the news.
            </p>
            <div className="home-heroActions">
              <Link className="home-action home-actionPrimary" href="/proof">
                Go to analytics <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <a className="home-action" href="#how-it-works">
                How it works <ArrowDown size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className="home-signalMap" aria-hidden="true">
            <div className="home-radarField">
              <div className="home-radarRing" />
              <div className="home-radarRing" />
              <div className="home-radarRing" />
              <div className="home-radarRing" />
              <div className="home-radarCore">
                <Radar size={32} strokeWidth={1.55} />
              </div>
            </div>
            {sources.map(({ Icon, signal }) => (
              <div className="home-mapSignal" key={signal}>
                <Icon size={15} strokeWidth={1.7} /> {signal}
              </div>
            ))}
          </div>
        </section>
        <section className="home-preview" aria-labelledby="preview-title">
          <div className="home-previewCopy">
            <p className="home-previewScope">Portfolio examples · Germany</p>
            <h2 id="preview-title">
              Explore the portfolio examples.
            </h2>
            <p>
              Browse German startups backed by HTGF and see what they build,
              when their funding was announced, and how much they raised.
            </p>
          </div>
          <Link href={`/proof/${example.slug}`} className="home-previewCard">
            <div className="home-cardTitle">
              <Image
                className="home-companyLogo"
                src={`/candidate-logos/${example.logo}`}
                alt=""
                width={170}
                height={70}
                unoptimized
              />
              <div>
                <h3>{example.name}</h3>
                <p>{example.sector} · {example.location}</p>
              </div>
            </div>
            <p className="home-cardDescription">{example.description}</p>
            <dl>
              <div>
                <dt>Round amount</dt>
                <dd>{example.round.amount}</dd>
              </div>
              <div>
                <dt>Round stage</dt>
                <dd>{example.round.stage}</dd>
              </div>
              <div>
                <dt>Announced</dt>
                <dd>
                  <time dateTime={example.round.date}>
                    {announcementDate.format(new Date(example.round.date))}
                  </time>
                </dd>
              </div>
            </dl>
            <span className="home-previewLink">
              View company profile <ArrowRight size={16} aria-hidden="true" />
            </span>
          </Link>
        </section>
        <section
          className="home-method"
          id="how-it-works"
          aria-labelledby="method-title"
        >
          <h2 id="method-title">Where early signals appear</h2>
          <p>
            When a founder turns up across these sources, we link the evidence
            so you can review the team in one place.
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
