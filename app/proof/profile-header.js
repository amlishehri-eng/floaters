import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import CompanyLogo from "./company-logo";
import CompanyWebsite from "./company-website";

export default function ProfileHeader({ company, label }) {
  return (
    <>
      <Link className="candidate-back" href="/proof">
        <ArrowLeft size={17} aria-hidden="true" /> All candidates
      </Link>
      <header className="candidate-profileHeader">
        <div>
          <p className="candidate-kicker">{label}</p>
          <h1>{company.name}</h1>
          <p className="candidate-location">
            <MapPin size={16} aria-hidden="true" /> {company.location}
            <span>·</span> {company.sector}
          </p>
          <CompanyWebsite website={company.website} />
        </div>
        <CompanyLogo company={company} />
      </header>
    </>
  );
}
