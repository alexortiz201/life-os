export const VALIDATION_RULES = ["PARSE_FAILED", "DRIFT_DETECTED"] as const;
export const STAGE = "VALIDATION" as const;
export const DECISION_TYPES = [
  "APPROVE",
  "REJECT",
  "PARTIAL_APPROVE",
  "ESCALATE",
] as const;
