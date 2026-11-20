import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import CompanyLogo from "./company-logo";

export default function CandidateCard({ company, href, fit, fitLabel }) {
  return (
    <Link className="candidate-card" href={href}>
      <CompanyLogo company={company} />
      <div className="candidate-cardBody">
        <div className="candidate-cardMeta">
          <span className="candidate-sector">{company.sector}</span>
          <span className="candidate-fitBadge">
            {fitLabel} <strong>{fit}</strong>
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
  );
}
