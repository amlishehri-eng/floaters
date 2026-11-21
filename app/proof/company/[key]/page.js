import Link from "next/link";
import CriteriaRows from "@/components/ff/criteria-rows";
import SiteNav from "@/components/ff/site-nav";
import { getExtras, getLeads, getVotes, latestVotes } from "@/lib/n8n";
import { companyPage } from "@/lib/screen/company";
import { sourceHint } from "@/lib/screen/format";
import "../../live/call-list.css";
import "./company.css";

// Company page: everything about one lead (live Leads table via getLeads(), the snapshot when n8n does not answer).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { key } = await params;
  const { leads } = await getLeads();
  const lead = leads.find((l) => l.id === decodeURIComponent(key));
  return { title: `${lead?.name || "Company not found"} | Founders First` };
}

function Spec({ title, aside, children }) {
  return (
    <section className="cl-spec">
      <div className="cl-spec__label">
        <h2 className="co-h">{title}</h2>
        {aside && <span>{aside}</span>}
      </div>
      <div className="co-facts">{children}</div>
    </section>
  );
}

function Fact({ label, children }) {
  return (
    <div className="co-fact">
      <span className="co-fact__label">{label}</span>
      <span className="co-fact__value">{children}</span>
    </div>
  );
}

export default async function CompanyPage({ params }) {
  const { key: raw } = await params;
  const key = decodeURIComponent(raw);
  const [leadsData, votesData, extras] = await Promise.all([getLeads(), getVotes(), getExtras()]);
  const lead = leadsData.leads.find((l) => l.id === key);
  const hint = sourceHint({ mocked: leadsData.mocked, error: leadsData.error, asOf: leadsData.as_of });

  if (!lead) {
    return (
      <div className="ff ff--call">
        <SiteNav theme="call" />
        <main className="co-main">
          <h1 className="co-title">This company isn’t in the leads table.</h1>
          <p className="co-lead">No lead has the key “{key}”. It may have been merged into another lead. <Link href="/proof/live">Back to the call list</Link></p>
          <p className="ff-source">{hint}</p>
        </main>
      </div>
    );
  }

  const v = companyPage(lead, { vote: latestVotes(votesData.votes).get(key) || null, labs: extras.labs });
  return (
    <div className="ff ff--call">
      <SiteNav theme="call" />
      <main className="co-main">
        <article className="cl-sheet co-sheet" aria-label={`Profile of ${v.name}`}>
          <div className="cl-head">
            <div className="cl-head__text">
              <span className="cl-head__place">{v.place}</span>
              <h1 className="co-title">{v.name}</h1>
              <span className="co-verdict">
                {v.callNow && <span className="ff-dot" aria-hidden="true" />}
                <span style={v.callNow ? { color: "#b8321a" } : undefined}>{v.verdictLabel}</span>
              </span>
              <div className="co-links">
                {v.website ? (
                  <a href={v.website} target="_blank" rel="noreferrer" className="ff-btn co-btn">Visit the website</a>
                ) : (
                  <span className="cl-muted13">No website found yet.</span>
                )}
                {v.profiles.map((p) => <a key={p.url} href={p.url} target="_blank" rel="noreferrer" className="ff-btn ff-btn--secondary co-btn">{p.label}</a>)}
              </div>
            </div>
            <div className="cl-rings" aria-label="Scores">
              {v.rings.map((r) => (
                <div key={r.label} className="cl-ring">
                  <div className="cl-ring__disc" style={{ background: `conic-gradient(${r.color} ${r.deg}deg, #eef1f6 0deg)` }} role="img" aria-label={r.aria}>
                    <div className="cl-ring__inner" aria-hidden="true">{r.value}</div>
                  </div>
                  <span className="cl-ring__label">{r.label}</span>
                  <span className="cl-ring__sub">{r.sub}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="cl-specs">
            <Spec title="About the company">
              <p className="co-lead">{v.about.description}</p>
              {v.about.rows.map((r) => <Fact key={r.label} label={r.label}>{r.value}</Fact>)}
            </Spec>

            <Spec title="Founders and team" aside={v.founders.people.length ? `${v.founders.people.length} named` : ""}>
              {v.founders.people.length ? (
                v.founders.people.map((p) => (
                  <Fact key={p.name} label={p.name}>
                    {p.role || "role not named"}
                    {p.linkedin && <> · <a href={p.linkedin} target="_blank" rel="noreferrer">LinkedIn</a></>}
                  </Fact>
                ))
              ) : (
                <p className="cl-days__text">No founders named yet.</p>
              )}
              {v.founders.background.map((b) => <p key={b} className="co-note">{b}</p>)}
            </Spec>

            <Spec title="Fit and team">
              <div className="cl-fitteam">
                <CriteriaRows rows={v.fitRows} fill="#1d1d1f" />
                <CriteriaRows rows={v.teamRows} fill="#0a6e99" />
                <span className="cl-fitteam__note">
                  Click a row to see why it scored that. “Not known” means the sources say nothing yet.
                  Germany is a hard rule in the HTGF check, so it scores no points here.
                  {v.antiSignals.length > 0 && ` Points off: ${v.antiSignals.join(", ")}.`}
                </span>
              </div>
            </Spec>

            <Spec title="HTGF check">
              <div>
                {v.checks.map((c) => (
                  <div key={c.key} className="cl-check">
                    <span className="cl-check__label">{c.label}</span>
                    <span className="cl-check__result" style={{ color: c.ink }}><span style={{ background: c.dot }} aria-hidden="true" />{c.result}</span>
                    <span className="cl-check__evidence">{c.evidence}</span>
                  </div>
                ))}
                <div className="cl-check">
                  <span className="cl-check__label">High-tech</span>
                  <span className="cl-check__result" style={{ color: v.highTech.ink }}><span style={{ background: v.highTech.dot }} aria-hidden="true" />{v.highTech.result}</span>
                  <span className="cl-check__evidence">{v.highTech.evidence}</span>
                </div>
              </div>
            </Spec>

            <Spec title="Age and register">
              {v.ageRows.map((r) => (
                <Fact key={r.label} label={r.label}>
                  {r.value} {r.url && <a href={r.url} target="_blank" rel="noreferrer">Source</a>}
                </Fact>
              ))}
              {v.ageWarning && <p className="cl-age co-age">Check the age first. {v.ageWarning}</p>}
            </Spec>

            <Spec title="Funding">
              <div className="cl-funding">
                <span className="cl-funding__status">{v.funding.status}</span>
                <span className="cl-funding__evidence">{v.funding.evidence}</span>
                <span className="cl-funding__co">Co-investors: {v.funding.coInvestors}</span>
              </div>
            </Spec>

            <Spec title="Capital need">
              <Fact label="Needs an €800k+ round">
                {v.capital.value} {v.capital.url && <a href={v.capital.url} target="_blank" rel="noreferrer">Source</a>}
              </Fact>
              {v.capital.why && <p className="co-note">{v.capital.why}</p>}
            </Spec>

            <Spec title="Why now">
              <p className="cl-days" style={{ color: v.daysInk }}>{v.days.badge}</p>
              <p className="cl-days__text">
                {v.days.text}{" "}
                {v.days.pressUrl && <a href={v.days.pressUrl} target="_blank" rel="noreferrer">See the first mention</a>}
              </p>
              <p className="co-note">Next step: {v.next}</p>
            </Spec>

            <Spec title="Deep checks" aside={v.deep.when}>
              {v.deep.checked ? (
                <div className="cl-deep">
                  {v.deep.items.map((d) => (
                    <div key={d.label} className="cl-deep__item">
                      <span className="cl-deep__head"><span className="cl-deep__label">{d.label}</span><span style={{ color: d.ink, fontWeight: 600 }}>{d.value}</span></span>
                      <span className="cl-deep__note">{d.note}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="cl-notchecked">Not checked yet. Flight risk, IP, competitors, Series A risk and an intro path appear after the next deep-check run.</p>
              )}
            </Spec>

            <Spec title="Research and labs">
              {v.research.papers.length ? (
                v.research.papers.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer" className="co-link">Research source: {u.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}</a>)
              ) : (
                <p className="cl-days__text">No research or patent source in the traces yet.</p>
              )}
              {v.research.lab ? (
                <p className="co-note">{v.research.lab.name} is on the <Link href="/proof/labs">labs to visit</Link> list (gap score {v.research.lab.gap}).</p>
              ) : null}
            </Spec>

            <Spec title="Sources" aside={v.sources.line}>
              {v.quotes.map((q) => <blockquote key={q} className="co-quote">{q}</blockquote>)}
              {v.quotes.length === 0 && <p className="cl-days__text">No quotes in the traces yet.</p>}
              {v.traces.map((t) => (
                <span key={t.url} className="cl-muted13">
                  <a href={t.url} target="_blank" rel="noreferrer">{t.label}</a>{t.date ? `, ${t.date}` : ""}
                </span>
              ))}
              {v.traces.length === 0 && v.sources.matches.map((m) => (
                <span key={m.id} className="cl-muted13">{m.url ? <a href={m.url} target="_blank" rel="noreferrer">{m.id}</a> : m.id}, {m.how}</span>
              ))}
              {v.sources.type && <span className="cl-muted13">{v.sources.type}</span>}
            </Spec>

            <Spec title="Feedback">
              {v.vote ? (
                <>
                  <p className="cl-days__text">{v.vote.text}</p>
                  {v.vote.reason && <p className="co-note">Reason: {v.vote.reason}</p>}
                </>
              ) : (
                <p className="cl-days__text">No vote yet. Mark it on the <Link href={`/proof/live?lead=${encodeURIComponent(v.key)}`}>call list</Link>.</p>
              )}
            </Spec>
          </div>
        </article>
        <p className="ff-source">{hint}</p>
      </main>
    </div>
  );
}
