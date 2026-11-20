import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import companies from "@/data/portfolio-examples.json";
import fixture from "@/data/proof-leads.json";
import SavedCandidates from "./saved-candidates";
import CandidateCard from "./candidate-card";
import { fitScore, maxFit } from "./fit-scoring";

export const metadata = {
  title: "Startup candidates | Founders First",
  description:
    "Explore German HTGF portfolio examples and their illustrative VC fit scores.",
};

export default function CandidatesPage() {
  return (
    <main className="candidate-shell candidate-main">
      <section className="candidate-intro">
        <p className="candidate-kicker">Analytics</p>
        <h1>Startup candidates</h1>
        <p>
          Review the teams you shortlisted during the demo, or browse publicly
          documented HTGF portfolio examples across Germany.
        </p>
        <div className="candidate-introActions">
          <Link className="candidate-introLink" href="/proof/search">
            Start search demo <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <Link className="candidate-introLink" href="/proof/methodology">
            How we score VC fit <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
      <SavedCandidates leads={fixture.leads} />
      <section className="candidate-about" aria-labelledby="portfolio-title">
        <h2 id="portfolio-title">HTGF portfolio examples</h2>
        <ul className="candidate-grid">
          {companies.map((company) => (
            <li key={company.slug}>
              <CandidateCard
                company={company}
                href={`/proof/${company.slug}`}
                fit={`${fitScore(company)}/${maxFit}`}
                fitLabel="Illustrative fit"
              />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
