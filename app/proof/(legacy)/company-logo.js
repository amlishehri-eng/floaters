import Image from "next/image";

export default function CompanyLogo({ company }) {
  return (
    <div className="candidate-logo">
      {company.logo ? (
        <Image
          src={`/candidate-logos/${company.logo}`}
          alt=""
          width={190}
          height={64}
          unoptimized
        />
      ) : (
        <span className="candidate-initials" aria-hidden="true">
          {company.name
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word[0])
            .join("")}
        </span>
      )}
    </div>
  );
}
