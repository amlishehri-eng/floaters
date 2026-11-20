import SiteNav from "@/components/ff/site-nav";
import { getExtras } from "@/lib/n8n";
import { FIT_V3, TEAM, TIMING, label } from "@/lib/screen/criteria";
import { backtestView } from "@/lib/screen/extras";
import { sourceHint } from "@/lib/screen/format";
import "./method.css";

// Method (design/reference/method.dc.html). Weights come from lib/screen/criteria.js (same as the n8n scoring),
// the backtest from flow 46 (or its snapshot).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Method | Founders First",
  description: "Hard rules first, points second: how a team reaches the call list.",
};

const GATES = [
  { title: "Germany", text: "Seat or base of operations in Germany. Every city counts the same." },
  { title: "Under 3 years", text: "From the register date or a stated founding date." },
  { title: "HTGF sector", text: "Digital tech, industrial tech, life sciences or chemistry." },
  { title: "No VC round", text: "Out only after a VC-led seed, a Series A or more than €3M." },
  { title: "High-tech", text: "At least 15 of 25 on tech depth: hardware, research, own models on hard data." },
];

const rows = (list) => list.map((c) => ({ label: label(c.key), max: c.weight }));
const SCORES = [
  {
    title: "HTGF fit",
    color: "#1d1d1f",
    rows: rows(FIT_V3),
    note: "Germany, sector, stage and funding are hard rules above, so they earn no points. Up to 30 points off for a thin AI wrapper, agency income, polish without a product or founders on too many projects.",
  },
  { title: "Team", color: "#0a6e99", rows: rows(TEAM), note: "Scored only on the criteria the sources speak to, and shown as how many of eight are known." },
  { title: "Timing", color: "#d93d1e", rows: rows(TIMING), note: "Says when to call, not whether. It sorts the call list." },
];

export default async function MethodPage() {
  const extras = await getExtras();
  const bt = backtestView(extras.backtest);
  return (
    <div className="ff ff--white">
      <SiteNav current="method" theme="white" />
      <main className="me-main">
        <section className="me-hero">
          <h1>Hard rules first. Points second.</h1>
          <p>Every point names the sentence it came from. When the sources say nothing about a criterion, it counts as not known, never as weak.</p>
        </section>

        <section className="me-gates-wrap">
          <h2>Five gates. Fail one and the team is out.</h2>
          <div className="me-gates">
            {GATES.map((g) => (
              <div key={g.title} className="me-gate">
                <span className="me-gate__title">{g.title}</span>
                <span className="me-gate__text">{g.text}</span>
              </div>
            ))}
          </div>
          <p className="me-gates__note">Business angels, grants, prizes, a pre-seed round or a search for investors never kill a lead. HTGF invests alongside them, so they show up as funding status instead.</p>
        </section>

        <section className="me-scores">
          {SCORES.map((sc) => (
            <div key={sc.title} className="me-score">
              <span className="me-score__max" style={{ color: sc.color }}>{sc.rows.reduce((t, r) => t + r.max, 0)}</span>
              <h2>{sc.title}</h2>
              {sc.rows.map((r) => (
                <div key={r.label} className="me-score__row"><span>{r.label}</span><span>{r.max}</span></div>
              ))}
              <p>{sc.note}</p>
            </div>
          ))}
        </section>
      </main>

      <section className="me-band">
        <div className="me-band__inner">
          <div className="me-band__rule">
            <span className="me-band__title"><span className="ff-dot me-band__dot" aria-hidden="true" />When a team goes on the call list</span>
            <p>It passes every gate, scores at least 70 percent on tech depth with evidence, has a known technical founder, clears 60 on the team criteria we know and 55 on fit, and has one outside proof: corporate pull, research or a patent, a grant, a prize or an accelerator.</p>
          </div>
          <div className="me-band__calib">
            <span className="me-band__ion">Calibrated by hand</span>
            <div className="me-band__nums">
              <span className="me-band__from">14</span>
              <span className="me-band__to-word">to</span>
              <span className="me-band__to">20</span>
              <span className="me-band__of">of 20</span>
            </div>
            <p>Twenty traces from every source, labelled blind. The first prompt agreed on 14, the tuned rules on all 20.</p>
          </div>
        </div>
      </section>

      <section className="me-bt">
        <div className="me-bt__inner">
          <div className="me-bt__head">
            <h2>Tested blind on HTGF’s own portfolio.</h2>
            <p>
              {bt
                ? `${bt.nWords} portfolio companies on their earliest archived website, investor mentions removed, against ${bt.controlWords} teams from our sources.`
                : "Portfolio companies on their earliest archived website, investor mentions removed, against teams from our sources."}
            </p>
          </div>
          {bt ? (
            <div className="me-bt__table">
              <div className="me-bt__row me-bt__row--head"><span>Stage</span><span>HTGF portfolio</span><span>Our sources</span></div>
              {bt.table.map((r) => (
                <div key={r.stage} className="me-bt__row">
                  <span className="me-bt__stage">{r.stage}</span>
                  <span className="me-bt__n" style={{ color: r.pInk }}>{r.p}</span>
                  <span className="me-bt__n me-bt__n--c">{r.c}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="me-bt__foot">Not run yet. The blind backtest (flow 41) fills this table.</p>
          )}
          <p className="me-bt__foot">
            {bt ? bt.footnote : ""}
            {` ${sourceHint({ mocked: extras.mocked, error: extras.error, asOf: bt?.runAt || extras.as_of })}`}
          </p>
        </div>
      </section>
    </div>
  );
}
