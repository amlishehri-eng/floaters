import Image from "next/image";

export default function CompanyLogo({ company }) {
  return (
    <div className="candidate-logo">
      <Image
        src={`/candidate-logos/${company.logo}`}
        alt=""
        width={190}
        height={64}
        unoptimized
      />
    </div>
  );
}
