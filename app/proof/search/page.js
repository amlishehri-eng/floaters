import fixture from "@/data/proof-leads.json";
import SearchDemo from "./search-demo";
import "./search.css";

export const metadata = {
  title: "Search demo | Founders First",
  description:
    "Walk through a simulated startup search and inspect the shortlist.",
};

export default function SearchDemoPage() {
  return <SearchDemo leads={fixture.leads} />;
}
