import { ArrowUpRight } from "lucide-react";

export default function CompanyWebsite({ website }) {
  let url;
  try {
    url = new URL(website);
  } catch {
    // The pipeline may have no confirmed website for a lead.
  }

  if (
    !url ||
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    return (
      <p className="candidate-websiteUnavailable">
        Company website unavailable
      </p>
    );
  }

  return (
    <a
      className="candidate-website"
      href={url.href}
      target="_blank"
      rel="noopener noreferrer"
    >
      Visit company website <ArrowUpRight size={16} aria-hidden="true" />
    </a>
  );
}
