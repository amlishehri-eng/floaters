import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import companies from "@/data/portfolio-examples.json";
import CompanyLogo from "./company-logo";

export const metadata = {
  title: "Startup candidates | Founders First",
  description: "Browse real startup examples from the Munich area.",
};

export default function CandidatesPage() {
  return (
    <main className="candidate-shell candidate-main">
      <section className="candidate-intro">
        <p className="candidate-kicker">Analytics</p>
        <h1>Startup candidates</h1>
        <p>
          Browse real HTGF-backed companies from the Munich area. These
          portfolio examples show how candidate profiles will look once Founders
          First has sourced its own leads.
        </p>
      </section>
      <ul className="candidate-grid" aria-label="Portfolio examples">
        {companies.map((company) => (
          <li key={company.slug}>
            <Link className="candidate-card" href={`/proof/${company.slug}`}>
              <CompanyLogo company={company} />
              <div className="candidate-cardBody">
                <span className="candidate-sector">{company.sector}</span>
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
