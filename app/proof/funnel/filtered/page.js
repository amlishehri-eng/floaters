import Link from "next/link";
import SiteNav from "@/components/ff/site-nav";
import { getLeads, getVotes, latestVotes } from "@/lib/n8n";
import { filteredPage } from "@/lib/screen/filtered";
import { sourceHint } from "@/lib/screen/format";
import FilteredGrid, { NearCard } from "./filtered-grid";
import "../../candidates/candidates.css";
import "./filtered.css";

// What the filter let go: every company that stopped after the HTGF gates (stages and reasons from lib/screen/funnel.js,
// shaped in lib/screen/filtered.js). ?stage=<gates|scored|standing|deep|all> and ?reason=<reason> are shareable.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "What the filter let go | Founders First",
  description: "Every company that stopped after the HTGF gates, with the reason and the numbers behind it.",
};

const href = (stage, reason) => {
  const q = new URLSearchParams();
  if (stage && stage !== "all") q.set("stage", stage);
  if (reason) q.set("reason", reason);
  const s = q.toString();
  return `/proof/funnel/filtered${s ? `?${s}` : ""}`;
};

export default async function FilteredPage({ searchParams }) {
  const [leadsData, votesData, params] = await Promise.all([getLeads(), getVotes(), searchParams]);
  const hint = sourceHint({ mocked: leadsData.mocked, error: leadsData.error, asOf: leadsData.as_of });
  const live = !leadsData.mocked && leadsData.leads.length > 50;
  const v = live
    ? filteredPage(leadsData.leads, {
        stage: typeof params?.stage === "string" ? params.stage : "all",
        reason: typeof params?.reason === "string" ? params.reason : "",
        asOf: leadsData.as_of,
        votes: latestVotes(votesData.votes),
      })
    : null;

  return (
    <div className="ff ff--paper">
      <SiteNav current="funnel" theme="paper" />
      <main className="fl-main">
        <Link href="/proof/funnel" className="fl-back">Back to the funnel</Link>
        <section className="fl-hero">
          <h1>What the filter let go.</h1>
          <p>Every company that stopped after the HTGF gates, with the reason and the numbers behind it.</p>
          <p className="ff-source">
            {hint} Bringing a company back adds it to your candidates. The engine’s verdict stays as it is.
          </p>
        </section>

        {!v ? (
          <p className="fl-empty">This page needs the live Leads table. Right now the site runs on the snapshot, which only holds the call list, so come back when n8n is reachable.</p>
        ) : (
          <>
            <nav aria-label="Stage" className="fl-tabs">
              {v.tabs.map((t) => (
                <Link key={t.key} href={href(t.key, "")} className="fl-tab" aria-current={v.current === t.key ? "page" : undefined}>
                  {t.label} <span className="fl-tab__n">{t.count}</span>
                </Link>
              ))}
            </nav>

            {v.near.length > 0 && !v.reason && (
              <section aria-label="Worth a second look" className="fl-near">
                <h2 className="fl-h2">Worth a second look</h2>
                <p className="ff-source">Flagged by rule, not by a model: close to a limit, or strong on fit or team.</p>
                <div className="po-grid">
                  {v.near.map((c) => <NearCard key={c.key} c={c} />)}
                </div>
              </section>
            )}

            <section aria-label="Reasons" className="fl-reasons">
              <h2 className="fl-h2">{v.total} stopped{v.reason ? `, ${v.cards.length} for “${v.reason}”` : ""}</h2>
              {v.reasons.map((r) => (
                <Link key={r.reason} href={href(v.current, r.current ? "" : r.reason)} className="fl-reason" aria-current={r.current ? "true" : undefined}>
                  <span className="fl-reason__head">
                    <span className="fl-reason__label">{r.reason}</span>
                    <span className="fl-reason__n">{r.n}</span>
                  </span>
                  <span className="fl-reason__bar" aria-hidden="true"><span style={{ width: `${r.pct}%` }} /></span>
                  {r.stat && <span className="fl-reason__stat">{r.stat}</span>}
                </Link>
              ))}
              {v.problems.length > 0 && <p className="ff-source">Mismatch in the funnel: {v.problems.join("; ")}.</p>}
            </section>

            <FilteredGrid cards={v.cards} />
          </>
        )}
      </main>
    </div>
  );
}
