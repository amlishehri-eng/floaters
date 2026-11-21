import SiteNav from "@/components/ff/site-nav";
import { getExtras } from "@/lib/n8n";
import { labsChart, labsPage } from "@/lib/screen/extras";
import { sourceHint } from "@/lib/screen/format";
import "./labs.css";

// Labs to visit (design/reference/labs.dc.html): the Labs table top 10 from flow 46, the snapshot when n8n does not answer.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Labs to visit | Founders First",
  description: "Labs with strong research in HTGF fields and few spin-offs so far.",
};

export default async function LabsPage() {
  const extras = await getExtras();
  const labs = labsPage(extras.labs);
  const chart = labsChart(extras.labs);
  return (
    <div className="ff">
      <SiteNav current="labs" />
      <main className="lb-main">
        <section className="lb-hero">
          <h1>Where the next spin-offs are hiding.</h1>
          <p>Labs with strong research in HTGF fields and few spin-offs so far. Go there before a team exists.</p>
        </section>

        {chart && (
          <section className="lb-chart" aria-labelledby="lb-chart-title">
            <h2 id="lb-chart-title">The gap at a glance</h2>
            <p className="lb-chart__summary">{chart.summary}</p>
            <div className="lb-chart__scroll">
              <table className="lb-table">
                <caption className="ff-sr-only">Papers in 24 months, spin-offs we know and gap score for the ten labs with the biggest gap. {chart.summary}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="lb-th-lab">Lab</th>
                    {[["works", "Papers in 24 months"], ["spin", "Spin-offs we know"], ["gap", "Gap score (of 100)"]].map(([k, label]) => (
                      <th key={k} scope="col">
                        <span className="lb-axis__label">{label}</span>
                        <span className="lb-axis" aria-hidden="true">
                          {chart.axes[k].map((t) => <span key={t.v} style={{ left: `${t.pct}%` }}>{t.label}</span>)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chart.rows.map((r) => (
                    <tr key={r.key}>
                      <th scope="row">{r.name}</th>
                      {[["works", "lb-bar--works"], ["spin", "lb-bar--spin"], ["gap", r.gap.call ? "lb-bar--call" : "lb-bar--gap"]].map(([k, cls]) => (
                        <td key={k}>
                          <span className="lb-cell" tabIndex={0} data-tip={r[k].tip} aria-label={r[k].tip}>
                            <span className="lb-track" aria-hidden="true"><span className={`lb-bar ${cls}`} style={{ width: `${Math.max(r[k].pct, 0.8)}%` }} /></span>
                            <span className="lb-val" aria-hidden="true">{r[k].n}</span>
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="lb-chart__key"><span className="lb-key lb-bar--works" aria-hidden="true" />Papers, from OpenAlex <span className="lb-key lb-bar--spin" aria-hidden="true" />Spin-offs from our own sources <span className="lb-key lb-bar--gap" aria-hidden="true" />Gap score{chart.rows[0]?.gap.call ? <> <span className="lb-key lb-bar--call" aria-hidden="true" />Top gap, worth a visit now</> : null}</p>
          </section>
        )}

        <section aria-label="Labs ranked by gap score" className="lb-list">
          {labs.map((l) => (
            <article key={l.key} className="lb-lab">
              <span className="lb-rank" aria-hidden="true">{l.rank}</span>
              <div className="lb-text">
                <h2>{l.name}</h2>
                <span className="lb-where">{l.city}, {l.fields}</span>
                <p>{l.why}</p>
                {l.paper && l.paperUrl && <a href={l.paperUrl} target="_blank" rel="noreferrer">Read the top paper: {l.paper}</a>}
              </div>
              <div className="lb-numbers">
                <div className="lb-gap">
                  <span className="lb-gap__head"><span>Gap score</span><span className="lb-gap__n">{l.gap}</span></span>
                  <span className="lb-gap__track"><span style={{ width: `${l.gapPct}%` }} /></span>
                </div>
                <div className="lb-pair">
                  <div><span className="lb-big">{l.works}</span><span className="lb-cap">papers in 24 months</span></div>
                  <div><span className="lb-big">{l.spinoffs}</span><span className="lb-cap">spin-offs we know</span></div>
                </div>
              </div>
            </article>
          ))}
          {labs.length === 0 && <p className="lb-foot">No lab data yet. The lab run (flow 40) fills this list every morning.</p>}
        </section>
        <p className="lb-foot">
          Papers from OpenAlex. Spin-offs counted only from our own sources, so the number grows with every run and the gap score is a reason to visit, not a verdict.
          {` ${sourceHint({ mocked: extras.mocked, error: extras.error, asOf: labs[0]?.updatedAt || extras.as_of })}`}
        </p>
      </main>
    </div>
  );
}
