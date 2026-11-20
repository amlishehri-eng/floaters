import fixture from "@/data/proof-leads.json";
import ProofDashboard from "./proof-dashboard";

export const metadata = {
  title: "Find the Founders First | Proof",
  description:
    "Early startup signals, teams and the evidence behind each lead.",
};

export default function ProofPage() {
  return <ProofDashboard leads={fixture.leads} asOf={fixture.as_of} />;
}
