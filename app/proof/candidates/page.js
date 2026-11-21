import Link from "next/link";
import SiteNav from "@/components/ff/site-nav";
import { getCandidates } from "@/lib/n8n";
import { candidateCards } from "@/lib/screen/candidates";
import { sourceHint } from "@/lib/screen/format";
import "./candidates.css";

// Candidates: every lead marked "Good lead" on the call list (flow 42 votes, latest vote per lead wins), newest first.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Candidates | Founders First",
  description: "Teams worth a first call: every lead marked as a good lead on the call list.",
};

export default async function CandidatesPage() {
  const { leads, votes, candidates } = await getCandidates();
  const cards = candidateCards(candidates);
  return (
    <div className="ff ff--paper">
      <SiteNav current="candidates" theme="paper" />
      <main className="po-main">
        <section className="po-hero">
          <div className="po-hero__text">
            <h1>Teams worth a first call.</h1>
            <p>Every lead you mark as a good lead on the call list lands here.</p>
            <p className="ff-source">
              {sourceHint({ mocked: leads.mocked, error: leads.error, asOf: leads.as_of })}
              {votes.mocked && votes.error ? " Votes from this computer only, n8n not reachable." : ""}
            </p>
          </div>
        </section>

        {cards.length === 0 ? (
          <p className="po-empty">
            No candidates yet. Mark a lead as good lead on the <Link href="/proof/live">call list</Link>.
          </p>
        ) : (
          <section aria-label="Candidates" className="po-grid">
            {cards.map((c) => (
              <Link key={c.key} href={c.href} className={c.callNow ? "po-tile po-tile--matched" : "po-tile"}>
                <span className="po-tile__sub">{c.sector}, {c.city}</span>
                <h2>{c.name}</h2>
                {c.brought && <span className="po-tile__sub po-tile__brought">{c.brought}</span>}
                <div className="po-tile__round">
                  <span className="po-tile__amount">{c.fit}</span>
                  <span className="po-tile__sub">{c.voted}</span>
                </div>
                {c.callNow && (
                  <span className="po-tile__found"><span aria-hidden="true" />On the call list now</span>
                )}
              </Link>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
