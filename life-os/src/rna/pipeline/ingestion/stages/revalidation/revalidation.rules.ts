export const REVALIDATION_RULES = [
  "PARSE_FAILED",
  "DRIFT_DETECTED",
  "NON_ARTIFACT_EFFECTS_PRESENT",
  "PARTIAL_NOT_ALLOWED_BY_POLICY",
] as const;

export type RevalidationRule = (typeof REVALIDATION_RULES)[number];
