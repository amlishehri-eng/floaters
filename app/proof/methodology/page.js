import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { fitCriteria, maxFit } from "../fit-scoring";

export const metadata = {
  title: "VC fit methodology | Founders First",
  description: "See how Founders First scores VC fit in its startup candidate gallery.",
};

export default function MethodologyPage() {
  return (
    <main className="candidate-shell candidate-main candidate-profile">
      <Link className="candidate-back" href="/proof">
        <ArrowLeft size={17} aria-hidden="true" /> All candidates
      </Link>
      <header className="candidate-intro candidate-methodIntro">
        <h1>VC fit methodology</h1>
        <p>
          A fit score out of {maxFit} helps a scout decide which profiles to review
          first. The gallery uses an illustrative, editorial application of the
          Founders First scoring weights.
        </p>
      </header>
      <section className="candidate-about" aria-labelledby="fit-criteria">
        <h2 id="fit-criteria">How the points add up</h2>
        <dl className="candidate-rubric">
          {fitCriteria.map(({ id, max, title, description }) => (
            <div key={id}>
              <dt>{title} <span>Up to {max} points</span></dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="candidate-about" aria-labelledby="fit-scope">
        <h2 id="fit-scope">How to read the gallery</h2>
        <p>
          Each score is a snapshot at the date of the linked HTGF announcement.
          The announcement establishes the funding facts. Round size and investor
          names add zero points. Because every example already has publicly
          announced financing, the maximum possible gallery score is{" "}
          {maxFit - fitCriteria.find(({ id }) => id === "no_funding").max}.
        </p>
        <p>
          The gallery is a retrospective portfolio sample across Germany.
          The separate sourcing demo uses fictional, Munich-focused leads and
          also shows team strength and evidence from source traces. Founders First
          assigns the gallery scores for screening. Investment decisions require
          independent diligence.
        </p>
      </section>
    </main>
  );
}
