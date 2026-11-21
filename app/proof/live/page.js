import SiteNav from "@/components/ff/site-nav";
import { getFunnel, getLeads } from "@/lib/n8n";
import { contactedMap } from "@/lib/outreach";
import { callList } from "@/lib/screen/call-list";
import CallList from "./call-list";
import "./call-list.css";

// Real leads from n8n on every visit (no caching); the dated Leads snapshot when n8n does not answer.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Today’s call list | Founders First",
  description: "The teams worth a call today, with the evidence behind every score.",
};

export default async function CallListPage({ searchParams }) {
  const [{ leads, as_of, mocked, error }, funnel, params, contacts] = await Promise.all([getLeads(), getFunnel(), searchParams, contactedMap()]);
  const view = callList({ leads, asOf: as_of, funnel, mocked, error });
  const wanted = typeof params?.lead === "string" ? params.lead : "";
  const initial = Math.max(0, view.rows.findIndex((r) => r.key === wanted));
  return (
    <div className="ff ff--call">
      <SiteNav current="call-list" theme="call" />
      <CallList
        intro={view.intro}
        rows={view.rows}
        details={view.details}
        memos={view.memos}
        asOf={as_of}
        initial={initial}
        contacted={Object.fromEntries([...contacts].map(([k, c]) => [k, c.at]))}
      />
    </div>
  );
}
