import { ArrowUpRight } from "lucide-react";
import { publicHttpUrl } from "./company-website";

export default function ScoreCriteria({ label, criteria, signals }) {
  if (!criteria?.length) {
    return <p className="proof-criteriaNote">{label} criteria are not available yet.</p>;
  }

  const signalsById = new Map(signals.map((signal) => [signal.trace_id, signal]));
  return (
    <details className="proof-criteria">
      <summary>{label} breakdown</summary>
      <ul>
        {criteria.map((criterion) => (
          <li key={criterion.key}>
            <div className="proof-criterionHeading">
              <strong>{criterion.key.replaceAll("_", " ")}</strong>
              <span>{criterion.known === false ? "Not known yet" : `${criterion.points}/${criterion.max} points`}</span>
            </div>
            {criterion.unsupported && <span className="proof-unverified">Unverified</span>}
            {(criterion.why || criterion.unsupported) && (
              <p>{criterion.why || "No supporting trace supplied."}</p>
            )}
            {criterion.evidence?.map((source, index) => {
              const signal = signalsById.get(source.trace_id);
              const href = publicHttpUrl(source.url) || publicHttpUrl(signal?.url);
              return (
                <div key={index} className="proof-criterionSource">
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      Source {index + 1} <ArrowUpRight size={13} aria-hidden="true" />
                    </a>
                  ) : (
                    <span>{source.trace_id ? `Trace ${source.trace_id}` : "Source link unavailable"}</span>
                  )}
                  {source.quote && <blockquote>“{source.quote}”</blockquote>}
                </div>
              );
            })}
          </li>
        ))}
      </ul>
    </details>
  );
}
