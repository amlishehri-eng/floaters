import { ArrowUpRight } from "lucide-react";

export function publicHttpUrl(value) {
  try {
    const url = new URL(value);
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) {
      return url.href;
    }
  } catch {
    // The pipeline may have no valid link.
  }
  return null;
}

export default function CompanyWebsite({ website }) {
  const href = publicHttpUrl(website);
  if (!href) {
    return (
      <p className="candidate-websiteUnavailable">
        Company website unavailable
      </p>
    );
  }

  return (
    <a
      className="candidate-website"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      Visit company website <ArrowUpRight size={16} aria-hidden="true" />
    </a>
  );
}
