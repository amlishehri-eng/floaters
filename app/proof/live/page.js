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
    <>
      <p
        role="status"
        style={{
          margin: 0,
          padding: "8px 16px",
          fontSize: 14,
          textAlign: "center",
          background: mocked ? "#f9eeda" : "#e5f4e4",
          color: "#1f1f1f",
        }}
      >
        {mocked
          ? `Showing demo leads: ${error || "mock mode is on"}. Is "20 Leads for the screen" published in n8n?`
          : `Live: ${leads.length} leads from the n8n Leads table, as of ${as_of}`}
      </p>
      <ProofDashboard leads={leads} asOf={as_of} />
    </>
  );
}
