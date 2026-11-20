import fixture from "@/data/proof-leads.json";
import Review from "./review";

export const metadata = {
  title: "Founders First | Sourcing demo",
  description:
    "Early startup signals, teams and the evidence behind each lead.",
};

export default async function ProofPage({ searchParams }) {
  const { lead } = await searchParams;
  return (
    <Review
      leads={fixture.leads}
      asOf={fixture.as_of}
      initialLeadId={typeof lead === "string" ? lead : undefined}
    />
  );
}
