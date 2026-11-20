"use client";

import Link from "next/link";
import { toggleDemoCandidate, useDemoWorkflow } from "../demo-workflow";
import ProofDashboard from "../proof-dashboard";

export default function Review({ leads, asOf, initialLeadId }) {
  const { reviewedIds, savedIds } = useDemoWorkflow();

  if (!reviewedIds?.length) {
    return (
      <main className="candidate-shell candidate-main">
        <section className="candidate-intro">
          <p className="candidate-kicker">Step 2 · Sourcing demo</p>
          <h1>
            {reviewedIds
              ? "No teams passed screening"
              : "Ready to review leads"}
          </h1>
          <p>
            Run a simulated search to fill this review queue. Once results
            arrive, select the teams you want to save under Candidates.
          </p>
          <Link className="candidate-introLink" href="/proof/search">
            Go to Search demo
          </Link>
        </section>
      </main>
    );
  }

  const queue = leads.filter((lead) => reviewedIds.includes(lead.id));
  return (
    <ProofDashboard
      key={initialLeadId}
      leads={queue}
      asOf={asOf}
      initialLeadId={initialLeadId}
      candidateReview={{ savedIds, onToggle: toggleDemoCandidate }}
    />
  );
}
