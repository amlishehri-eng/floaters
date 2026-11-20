import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, MapPin } from "lucide-react";
import companies from "@/data/portfolio-examples.json";
import CompanyLogo from "../company-logo";

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

export default async function CandidatePage({ params }) {
  const company = await getCompany(params);
  const { round } = company;

  return (
    <main className="candidate-shell candidate-main candidate-profile">
      <Link className="candidate-back" href="/proof">
        <ArrowLeft size={17} aria-hidden="true" /> All candidates
      </Link>
      <header className="candidate-profileHeader">
        <div>
          <p className="candidate-kicker">HTGF portfolio example</p>
          <h1>{company.name}</h1>
          <p className="candidate-location">
            <MapPin size={16} aria-hidden="true" /> {company.location}{" "}
            <span>·</span> {company.sector}
          </p>
        </div>
        <CompanyLogo company={company} />
      </header>
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
              <time dateTime={round.date}>
                {dateFormatter.format(new Date(round.date))}
              </time>
            </dd>
          </div>
        </dl>
        <a className="candidate-source" href={round.source}>
          Read the HTGF announcement{" "}
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </section>
    </main>
  );
}
