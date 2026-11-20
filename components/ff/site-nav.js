import Link from "next/link";

// Top navigation for every Founders First page (DESIGN.md section 4). theme: dark | paper | call | white.
const LINKS = [
  { key: "call-list", href: "/proof/live", label: "Call list" },
  { key: "funnel", href: "/proof/funnel", label: "Funnel" },
  { key: "labs", href: "/proof/labs", label: "Labs" },
  { key: "portfolio", href: "/proof", label: "Portfolio" },
  { key: "method", href: "/proof/methodology", label: "Method" },
];

export default function SiteNav({ current, theme = "paper" }) {
  return (
    <header className={`ff-nav ff-nav--${theme}`}>
      <div className="ff-nav__inner">
        <Link href="/" className="ff-nav__brand">Founders First</Link>
        <nav aria-label="Main" className="ff-nav__links">
          {LINKS.map((l) => (
            <Link key={l.key} href={l.href} className="ff-nav__link" aria-current={current === l.key ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
