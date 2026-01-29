export const VALIDATION_RULES = ["PARSE_FAILED", "DRIFT_DETECTED"] as const;
export const STAGE = "INTAKE" as const;

export type ValidationRule = (typeof VALIDATION_RULES)[number];
