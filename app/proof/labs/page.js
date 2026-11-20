import SiteNav from "@/components/ff/site-nav";
import { getExtras } from "@/lib/n8n";
import { labsPage } from "@/lib/screen/extras";
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
  return (
    <div className="ff ff--paper">
      <SiteNav current="labs" theme="paper" />
      <main className="lb-main">
        <section className="lb-hero">
          <h1>Where the next spin-offs are hiding.</h1>
          <p>Labs with strong research in HTGF fields and few spin-offs so far. Go there before a team exists.</p>
        </section>

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
