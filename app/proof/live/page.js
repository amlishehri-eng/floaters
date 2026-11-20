import { getLeads } from "@/lib/n8n";
import ProofDashboard from "../proof-dashboard";

// Real leads from n8n on every visit (no caching).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Founders First | Live leads",
  description: "The leads our engine found, straight from the n8n Leads table.",
};

export default async function LiveLeadsPage() {
  const { leads, as_of, mocked, error } = await getLeads();
  return (
    <ProofDashboard leads={leads} asOf={as_of} demo={mocked} feedUnavailable={Boolean(error)} />
  );
}
