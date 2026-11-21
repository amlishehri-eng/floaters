import Link from "next/link";
import SiteNav from "@/components/ff/site-nav";
import coords from "@/data/city-coords.json";
import { getExtras, getFunnel, getLeads } from "@/lib/n8n";
import { sourceHint } from "@/lib/screen/format";
import { homePage } from "@/lib/screen/home";
import "./home.css";

// Home (design/reference/home.dc.html). Numbers from /api/funnel (flow 44), radar points = current call-now leads,
// backtest from flow 46. Each falls back to its dated snapshot.
export const dynamic = "force-dynamic";


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
  const leadsHint = sourceHint({ mocked: leadsData.mocked, error: leadsData.error, asOf: leadsData.as_of });
  const funnelHint = sourceHint({ mocked: funnel.mocked, error: funnel.error, asOf: funnel.as_of });
  return (
    <div className="ff">
      <SiteNav />

      {/* First screen: everything here fits one viewport at 1280×800 and up (DESIGN.md, home). */}
      <section className="ho-first" aria-label={v.radarLabel}>
        <div className="ho-first__text">
          <h1>{v.title[0]}<br /><span>{v.title[1]}</span></h1>
          <p>Founders First reads Germany’s spin-off lists, research news, code and pitches every day, and tells HTGF who to call before anyone writes about them.</p>
          <div className="ho-hero__cta">
            <Link href="/proof/live" className="ho-btn">See the call list</Link>
            <Link href="/proof/funnel" className="ho-link">See how it filters</Link>
          </div>
          <div className="ho-big">
            {v.big.map((b) => (
              <div key={b.label}><span style={{ color: b.color }}>{b.n}</span><span>{b.callNow && <span className="ff-dot ho-big__dot" aria-hidden="true" />}{b.label}</span></div>
            ))}
          </div>
          <p className="ff-source">Teams on the map: {leadsHint}</p>
        </div>
        <div className="ho-first__map">
          <div className="ho-radar">
            {/* Mist land, then (clipped to the border) Stone rings and crosshair at R/10 steps, the Adriatic sweep of radius R
                and the trace dots, then the Stone border, then the call-now points, leader lines and label lists. */}
            <svg viewBox="0 0 600 800" className="ho-layer" aria-hidden="true">
              <polygon points={v.outline} fill="#f5f0e8" />
            </svg>
            <div className="ho-layer ho-clip" style={{ clipPath: v.clip }} aria-hidden="true">
              <svg viewBox="0 0 600 800" className="ho-layer ho-layer--fill">
                {v.radar.rings.map((r, i) => (
                  <circle key={r} cx={v.radar.cx} cy={v.radar.cy} r={r} fill="none" stroke="#8fa6b4" strokeOpacity={0.55 - i * 0.03} strokeWidth="1" />
                ))}
                <line x1={v.radar.cx} y1={v.radar.cy - v.radar.r} x2={v.radar.cx} y2={v.radar.cy + v.radar.r} stroke="#8fa6b4" strokeOpacity="0.4" />
                <line x1={v.radar.cx - v.radar.r} y1={v.radar.cy} x2={v.radar.cx + v.radar.r} y2={v.radar.cy} stroke="#8fa6b4" strokeOpacity="0.4" />
              </svg>
              <div
                className="ho-sweep"
                style={{ left: `${((v.radar.cx - v.radar.r) / 6).toFixed(3)}%`, top: `${((v.radar.cy - v.radar.r) / 8).toFixed(3)}%`, width: `${(v.radar.r / 3).toFixed(3)}%`, height: `${(v.radar.r / 4).toFixed(3)}%` }}
              />
              {v.dots.map((d, i) => (
                <span key={i} className="ho-dot" style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s, background: d.c, opacity: d.o }} />
              ))}
            </div>
            <svg viewBox="0 0 600 800" className="ho-layer" aria-hidden="true">
              <polygon points={v.outline} fill="none" stroke="#8fa6b4" strokeWidth="1.5" strokeLinejoin="round" />
              {v.labels.map((l) => (
                <line key={l.key} x1={l.leader.x1} y1={l.leader.y1} x2={l.leader.x2} y2={l.leader.y2} stroke="#8fa6b4" strokeWidth="1" />
              ))}
            </svg>
            <div className="ho-layer">
              {v.stars.map((t) => (
                <span key={t.key} className="ho-star" style={{ left: `${t.x}%`, top: `${t.y}%` }} aria-hidden="true" />
              ))}
              {v.labels.map((l) => (
                <span key={l.key} className="ho-labels" style={{ position: "absolute", display: "flex", flexDirection: "column", left: `${l.x}%`, top: `${l.y}%` }}>
                  {l.lines.map((line) => (
                    <span key={line.name} className="ho-label" style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap" }}>
                      <span className="ho-label__name">{line.name}</span>
                      <span className="ho-label__city">{line.city}</span>
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {v.top ? (
        <section className="ho-top">
          <span className="ho-top__kicker"><span className="ff-dot" aria-hidden="true" />Top of today’s list</span>
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

      <section className="ho-white ho-white--sources">
        <div className="ho-light__inner ho-light__inner--48">
          <h2>Where the first signals show up.</h2>
          <div className="ho-sources">
            {SOURCES.map((so) => (
              <div key={so.title} className="ho-source"><span>{so.title}</span><span>{so.text}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="ho-light ho-light--bt">
        <div className="ho-white__inner ho-bt">
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
        Founders First, an HTGF hackathon prototype. Funnel numbers: {funnelHint}
      </footer>
    </div>
  );
}
