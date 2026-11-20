import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import companies from "@/data/portfolio-examples.json";
import ProfileHeader from "../profile-header";
import { fitCriteria, fitScore, maxFit } from "../fit-scoring";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

async function getCompany(params) {
  const { slug } = await params;
  const company = companies.find((example) => example.slug === slug);
  if (!company) notFound();
  return company;
}

export function generateStaticParams() {
  return companies.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const company = await getCompany(params);
  return {
    title: `${company.name} | Founders First`,
    description: company.description,
  };
}

function scoreEvidence(company) {
  const { round, location, sector, fit } = company;
  return {
    germany: `The portfolio lists ${location} as the company’s base. The demo awards 20 points in the Munich area and 15 elsewhere in Germany.`,
    sector: `The announcement describes work in ${sector.toLowerCase()}. ${company.description}`,
    tech_depth: fit.rationale,
    stage:
      round.stage === "Series A"
        ? "The linked announcement reports a Series A. This falls outside the demo’s seed-or-earlier scoring window."
        : `The linked announcement reports a ${round.stage.toLowerCase()} round, which falls inside the demo’s early-stage scoring window.`,
    no_funding: `HTGF publicly announced this ${round.stage.toLowerCase()} round. The rubric awards zero funding-visibility points once institutional funding has been announced.`,
  };
}

export default async function CandidatePage({ params }) {
  const company = await getCompany(params);
  const { round } = company;
  const scoreDate = dateFormatter.format(new Date(round.date));
  const evidence = scoreEvidence(company);
  const portfolioSource = `https://www.htgf.de/en/portfolio/htgffamily/${company.slug}/`;

  return (
    <main className="candidate-shell candidate-main candidate-profile">
      <ProfileHeader company={company} label="HTGF portfolio example" />
      <section className="candidate-about" aria-labelledby="company-about">
        <h2 id="company-about">What they do</h2>
        <p>{company.description}</p>
      </section>
      <section
        className="candidate-financing"
        aria-labelledby="company-funding"
      >
        <h2 id="company-funding">Announced financing</h2>
        <dl className="candidate-metrics">
          <div>
            <dt>Round amount</dt>
            <dd>{round.amount ?? "Undisclosed"}</dd>
          </div>
          <div>
            <dt>Round stage</dt>
            <dd>{round.stage}</dd>
          </div>
          <div>
            <dt>Announcement date</dt>
            <dd>
              <time dateTime={round.date}>{scoreDate}</time>
            </dd>
          </div>
        </dl>
        <a className="candidate-source" href={round.source}>
          Read the HTGF announcement{" "}
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </section>
      <section className="candidate-about" aria-labelledby="company-fit">
        <div className="candidate-fitHeader">
          <h2 id="company-fit">Illustrative VC fit</h2>
          <span className="candidate-fitBadge">
            <strong>
              {fitScore(company)}/{maxFit}
            </strong>
          </span>
        </div>
        <p>
          Demo points reflect our interpretation of the funding announcement on{" "}
          <time dateTime={round.date}>{scoreDate}</time>.
        </p>
        <dl className="candidate-fitBreakdown candidate-fitEvidence">
          {fitCriteria.map(({ id, max, title }) => (
            <div key={id}>
              <dt>{title}</dt>
              <dd>
                {company.fit.points[id]}/{max}
              </dd>
            </div>
          ))}
        </dl>
        <Link className="candidate-source" href="/proof/methodology">
          Read the scoring methodology{" "}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
