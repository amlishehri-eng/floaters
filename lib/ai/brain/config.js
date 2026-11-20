// Every tunable number of the brain in one place.

// "Worth a call" = vc_backable and both scores at or above these.
export const WORTH_A_CALL = { fit: 70, team: 60 };

// Parallel OpenAI calls per run.
export const CONCURRENCY = 5;

// Step 3, rule 4: names this similar (0..1) but not equal get a yes/no check by the fast model.
export const SIMILARITY_THRESHOLD = 0.85;
export const MAX_SIMILARITY_CHECKS = 30;

// How much of each trace's text the models see.
export const MAX_TRACE_CHARS = 20_000;
export const MAX_EVIDENCE_CHARS_PER_TRACE = 1_500;

// Stage order for "highest stage" when merging mentions.
export const STAGES = ["unknown", "idea", "prototype", "pilot customers", "revenue"];
export const SECTORS = ["digital tech", "industrial tech", "life sciences", "chemistry", "other"];
export const ROLES = ["founder", "researcher", "student", "speaker", "other"];
export const QUOTE_KINDS = [
  "looking_for_cofounder",
  "first_pilot_customer",
  "planning_to_raise",
  "grant_or_award",
  "hiring_first_engineer",
  "other",
];
export const LABELS = ["hobby", "agency", "assignment", "vc_backable"];
