import { redirect } from "next/navigation";

// The old Portfolio address. The page is now Candidates.
export default function ProofIndex() {
  redirect("/proof/candidates");
}
