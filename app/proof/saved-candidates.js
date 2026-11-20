"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import CandidateCard from "./candidate-card";
import { useDemoWorkflow } from "./demo-workflow";

export default function SavedCandidates({ leads }) {
  const { savedIds } = useDemoWorkflow();
  const saved = leads.filter((lead) => savedIds.includes(lead.id));

  return (
    <section className="candidate-about" aria-labelledby="saved-title">
      <h2 id="saved-title">Saved candidates ({saved.length})</h2>
      <p>Fictional demo teams you shortlisted in Sourcing demo.</p>
      {saved.length ? (
        <ul className="candidate-grid">
          {saved.map((lead) => (
            <li key={lead.id}>
              <CandidateCard
                company={{ ...lead, location: lead.city }}
                href={`/proof/saved/${encodeURIComponent(lead.id)}`}
                fit={`${lead.fit_score}/100`}
                fitLabel="Demo fit"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p>Your shortlist is empty.</p>
      )}
      <Link className="candidate-source" href="/proof/demo">
        Go to Sourcing demo <ArrowUpRight size={17} aria-hidden="true" />
      </Link>
    </section>
  );
}
