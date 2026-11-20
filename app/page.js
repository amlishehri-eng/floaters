import Link from "next/link";
import SiteNav from "@/components/ff/site-nav";
import coords from "@/data/city-coords.json";
import { getExtras, getFunnel, getLeads } from "@/lib/n8n";
import { dataLine, longDate } from "@/lib/screen/format";
import { homePage } from "@/lib/screen/home";
import "./home.css";

// Home (design/reference/home.dc.html). Numbers from /api/funnel (flow 44), radar points = current call-now leads,
// backtest from flow 46. Each falls back to its dated snapshot.
export const dynamic = "force-dynamic";

const RINGS = [
  { inset: "6.216%", a: 0.18 }, { inset: "18.649%", a: 0.14 }, { inset: "31.081%", a: 0.12 }, { inset: "43.514%", a: 0.1 },
  { inset: "0", a: 0.22 }, { inset: "12.432%", a: 0.16 }, { inset: "24.865%", a: 0.13 }, { inset: "37.297%", a: 0.1 },
];

const SOURCES = [
  { title: "University spin-off lists", text: "Fifteen universities and institutes, from KIT to Max Planck." },
  { title: "Incubators and accelerators", text: "TUM Venture Labs and 28 cohort and competition pages." },
  { title: "Research news", text: "Spin-off and EXIST releases from idw, the science news service." },
  { title: "Code", text: "New GitHub organisations and Hugging Face models in 16 German cities." },
  { title: "First hires", text: "Job ads from young companies hiring their first people." },
  { title: "Pitches and boards", text: "Transcribed pitch podcasts, campus co-founder boards and Luma events." },
];

export default async function Home() {
  const [funnel, leadsData, extras] = await Promise.all([getFunnel(), getLeads(), getExtras()]);
  const v = homePage({ funnel, leads: leadsData.leads, extras, coords });
  const runDate = longDate(funnel.as_of);
  const offline = [funnel, leadsData, extras].filter((d) => d.mocked);
  return (
    <div className="ff ff--dark">
      <SiteNav theme="dark" />

      <section className="ho-hero">
        <h1>{v.title[0]}<br /><span>{v.title[1]}</span></h1>
        <p>Founders First reads Germany’s spin-off lists, research news, code and pitches every day, and tells HTGF who to call before anyone writes about them.</p>
        <div className="ho-hero__cta">
          <Link href="/proof/live" className="ho-btn">See the call list</Link>
          <Link href="/proof/funnel" className="ho-link">See how it filters</Link>
        </div>
      </section>

      <section aria-label={v.radarLabel} className="ho-radar-wrap">
        <div className="ho-radar">
          <div className="ho-layer ho-clip" style={{ clipPath: v.clip }} aria-hidden="true">
            <div className="ho-scope">
              {RINGS.map((r) => (
                <div key={r.inset} className="ho-ring" style={{ inset: r.inset, borderColor: `rgba(51,209,255,${r.a})` }} />
              ))}
              <div className="ho-cross ho-cross--v" />
              <div className="ho-cross ho-cross--h" />
              <div className="ho-sweep" />
            </div>
          </div>
          <svg viewBox="0 0 600 800" className="ho-layer" aria-hidden="true">
            <polygon points={v.outline} fill="rgba(51,209,255,0.05)" stroke="rgba(51,209,255,0.55)" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          <div className="ho-layer">
            {v.dots.map((d, i) => (
              <span key={i} className="ho-dot" style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s, background: d.c, opacity: d.o }} aria-hidden="true" />
            ))}
            {v.stars.map((t) => (
              <span key={t.key}>
                <span className="ho-star" style={{ left: `${t.x}%`, top: `${t.y}%` }} aria-hidden="true" />
                <span className={t.left ? "ho-label ho-label--left" : "ho-label"} style={{ left: `${t.lx}%`, top: `${t.ly}%` }}>
                  <span className="ho-label__name">{t.name}</span>
                  <span className="ho-label__city">{t.city}</span>
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="ho-big">
          {v.big.map((b) => (
            <div key={b.label}><span style={{ color: b.color }}>{b.n}</span><span>{b.label}</span></div>
          ))}
        </div>
      </section>

      <section className="ho-light">
        <div className="ho-light__inner">
          <h2>The cheapest step runs first. The expensive ones only where it matters.</h2>
          <div className="ho-steps">
            {v.steps.map((st) => (
              <div key={st.no} className="ho-step">
                <span className="ho-step__no" style={{ color: st.color }}>{st.no}</span>
                <span className="ho-step__title">{st.title}</span>
                <span className="ho-step__text">{st.text}</span>
                <span className="ho-step__cost">{st.cost}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {v.top ? (
        <section className="ho-top">
          <span className="ho-top__kicker">Top of today’s list</span>
          <h2>{v.top.name}</h2>
          <p>{v.top.what}</p>
          <div className="ho-top__numbers">
            {v.top.numbers.map((tp) => (
              <div key={tp.label}><span style={{ color: tp.color }}>{tp.n}</span><span>{tp.label}</span></div>
            ))}
          </div>
          <Link href={`/proof/live?lead=${encodeURIComponent(v.top.key)}`} className="ho-top__link">Open the lead</Link>
        </section>
      ) : (
        <section className="ho-top">
          <span className="ho-top__kicker">Top of today’s list</span>
          <p>No team is on the call list right now. New leads appear after the next pipeline run.</p>
        </section>
      )}

      <section className="ho-light">
        <div className="ho-light__inner ho-light__inner--48">
          <h2>Where the first signals show up.</h2>
          <div className="ho-sources">
            {SOURCES.map((so) => (
              <div key={so.title} className="ho-source"><span>{so.title}</span><span>{so.text}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="ho-white">
        <div className="ho-white__inner">
          <div className="ho-bt__text">
            <h2>Tested blind on HTGF’s own portfolio.</h2>
            <p>Earliest archived websites only, every investor mention removed. {v.backtest ? v.backtest.sentence : "The backtest has not run yet."}</p>
            <Link href="/proof/methodology">Read the method</Link>
          </div>
          {v.backtest && (
            <div className="ho-bt__bars">
              {v.backtest.bars.map((b) => (
                <div key={b.label} className="ho-bt__bar">
                  <span className="ho-bt__head"><span>{b.label}</span><span>{b.n} of {b.of}</span></span>
                  <span className="ho-bt__track"><span style={{ width: `${b.pct}%`, background: b.color }} /></span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="ho-footer">
        Founders First, an HTGF hackathon prototype. {runDate ? `Data from the run on ${runDate}.` : "Run date not known."}
        {offline.length > 0 && ` ${dataLine({ asOf: offline[0].as_of, mocked: true, error: offline.map((d) => d.error).filter(Boolean)[0] })}`}
      </footer>
    </div>
  );
}
