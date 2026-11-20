import SiteNav from "@/components/ff/site-nav";
import companies from "@/data/portfolio-examples.json";
import htgfPortfolio from "@/data/htgf-portfolio.json";
import { getLeads } from "@/lib/n8n";
import { dataLine, int } from "@/lib/screen/format";
import { portfolioPage } from "@/lib/screen/portfolio";
import "./portfolio.css";

// Portfolio (design/reference/portfolio.dc.html): known HTGF investments, and how many leads the engine recognised as portfolio.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Portfolio | Founders First",
  description: "Every lead is matched against HTGF's portfolio, so nobody calls a company HTGF already backs.",
};

export default async function PortfolioPage() {
  const { leads, as_of, mocked, error } = await getLeads();
  const v = portfolioPage({ companies, leads });
  const known = Array.isArray(htgfPortfolio) ? htgfPortfolio.length : htgfPortfolio?.companies?.length;
  return (
    <div className="ff ff--paper">
      <SiteNav current="portfolio" theme="paper" />
      <main className="po-main">
        <section className="po-hero">
          <div className="po-hero__text">
            <h1>It knows what HTGF already owns.</h1>
            <p>
              Every lead is matched against {known ? int(known) : "the"} portfolio companies. A match comes off the call list, so nobody calls a company HTGF already backs.
            </p>
            {mocked && <p className="ff-source">{dataLine({ asOf: as_of, mocked, error, what: "Leads" })}</p>}
          </div>
          <div className="po-count">
            <span>{int(v.count)}</span>
            <span>{v.count === 1 ? "lead recognised as portfolio" : "leads recognised as portfolio"}</span>
          </div>
        </section>

        <section aria-label="Portfolio examples" className="po-grid">
          {v.tiles.map((c) => (
            <article key={c.key} className={c.matched ? "po-tile po-tile--matched" : "po-tile"}>
              <span className="po-tile__sub">{c.sector}, {c.city}</span>
              <h2>{c.name}</h2>
              <div className="po-tile__round">
                <span className="po-tile__amount">{c.amount}</span>
                <span className="po-tile__sub">{c.stage}, {c.date}</span>
              </div>
              {c.matched && (
                <span className="po-tile__found"><span aria-hidden="true" />Found by our engine and marked as portfolio</span>
              )}
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
