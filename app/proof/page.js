import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import companies from "@/data/portfolio-examples.json";
import CompanyLogo from "./company-logo";
import { fitScore, maxFit } from "./fit-scoring";

export const metadata = {
  title: "Startup candidates | Founders First",
  description: "Explore German HTGF portfolio examples and their illustrative VC fit scores.",
};

export default function CandidatesPage() {
  return (
    <main className="candidate-shell candidate-main">
      <section className="candidate-intro">
        <p className="candidate-kicker">Analytics</p>
        <h1>Startup candidates</h1>
        <p>
          Explore HTGF-backed startups from across Germany. Each profile pairs a
          public funding announcement with an illustrative VC fit score for shortlist
          priority. The sourcing demo focuses on Munich.
        </p>
        <Link className="candidate-introLink" href="/proof/methodology">
          How we score VC fit <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </section>
      <ul className="candidate-grid" aria-label="Portfolio examples">
        {companies.map((company) => (
          <li key={company.slug}>
            <Link className="candidate-card" href={`/proof/${company.slug}`}>
              <CompanyLogo company={company} />
              <div className="candidate-cardBody">
                <div className="candidate-cardMeta">
                  <span className="candidate-sector">{company.sector}</span>
                  <span className="candidate-fitBadge">
                    Illustrative fit <strong>{fitScore(company)}/{maxFit}</strong>
                  </span>
                </div>
                <h2>
                  {company.name} <ArrowUpRight size={19} aria-hidden="true" />
                </h2>
                <p>
                  <MapPin size={14} aria-hidden="true" /> {company.location}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
