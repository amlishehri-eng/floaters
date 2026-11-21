import { redirect } from "next/navigation";

// Portfolio was renamed to Candidates.
export default function PortfolioRedirect() {
  redirect("/proof/candidates");
}
