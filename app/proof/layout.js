import Link from "next/link";
import { Radar } from "lucide-react";
import "./candidates.css";

export default function AnalyticsLayout({ children }) {
  return (
    <div className="candidate-site">
      <header className="candidate-header">
        <div className="candidate-shell candidate-nav">
          <Link href="/" className="candidate-brand">
            <span className="candidate-brandMark">
              <Radar aria-hidden="true" size={21} />
            </span>{" "}
            Founders First
          </Link>
          <nav aria-label="Analytics navigation">
            <Link href="/proof/search">1. Search demo</Link>
            <Link href="/proof/demo">2. Sourcing demo</Link>
            <Link href="/proof">3. Candidates</Link>
            <Link href="/proof/methodology">Scoring</Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
