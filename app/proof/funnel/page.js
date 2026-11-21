import SiteNav from "@/components/ff/site-nav";
import { getFunnel, getLeads } from "@/lib/n8n";
import { dayTime, sourceHint } from "@/lib/screen/format";
import { honestFunnel } from "@/lib/screen/funnel";
import FunnelDive from "./funnel-dive";
import "./funnel.css";

// Funnel (design/reference/funnel.dc.html): counts and costs from flow 44, the snapshot when n8n does not answer.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Funnel | Founders First",
  description: "How a few thousand faint signals become a short call list, and what each step costs.",
};

export default async function FunnelPage({ searchParams }) {
  const [funnel, leadsData, params] = await Promise.all([getFunnel(), getLeads(), searchParams]);
  const v = honestFunnel(funnel, leadsData, { mocked: funnel.mocked });
  const when = dayTime(funnel.as_of);
  return (
    <div className="ff ff--dark">
      <SiteNav current="funnel" theme="dark" />
      <main className="fu-main">
        <section className="fu-hero">
          <h1>{v.title[0]}<br /><span>{v.title[1]}</span></h1>
          <p>
            Every stage costs more than the one before, so each one only sees what the cheaper stage let through.
            {` ${sourceHint({ mocked: funnel.mocked, error: funnel.error, asOf: funnel.as_of })}`}
          </p>
        </section>

        <div className="fd-wrap">
          <FunnelDive stages={v.stages} lowerFrom={v.lowerFrom ?? 99} initialStage={typeof params?.stage === "string" ? params.stage : ""} />
          <p className="fu-note fd-hint">
            {v.diveNote || "Click a stage from the HTGF gates down to see who stopped there and why."}
            {v.problems?.length ? ` Mismatch in the funnel: ${v.problems.join("; ")}.` : ""}
          </p>
        </div>

        <section className="fu-cols">
          <div className="fu-col">
            <h2>Cut by code, for free</h2>
            {v.codeCuts.map((c) => (
              <div key={c.label} className="fu-line"><span>{c.label}</span><span className="fu-n">{c.n}</span></div>
            ))}
            {v.codeCuts.length === 0 && <p className="fu-note">Not known for this run.</p>}
            <p className="fu-note">{v.parkedNote}</p>
          </div>
          <div className="fu-col">
            <h2>{v.teamsLabel}</h2>
            {v.verdicts.map((x) => (
              <div key={x.key} className="fu-line">
                <span className="fu-verdict"><span style={{ background: x.color }} aria-hidden="true" />{x.label}</span>
                <span className="fu-n">{x.n}</span>
              </div>
            ))}
            {v.verdicts.length === 0 && <p className="fu-note">Not known for this run.</p>}
            <p className="fu-note">{when ? `Counted from the Leads table at ${when}.` : "Counted from the Leads table."}</p>
          </div>
          <div className="fu-col fu-col--costs">
            <h2>What it costs</h2>
            {v.costs.map((c) => (
              <div key={c.label} className="fu-cost">
                <span style={{ color: c.color }}>{c.n}</span>
                <span>{c.label}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
