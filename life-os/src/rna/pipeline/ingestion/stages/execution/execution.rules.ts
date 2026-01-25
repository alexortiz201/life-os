export const EXECUTION_RULES = ["PARSE_FAILED", "DRIFT_DETECTED"] as const;

export type ExecutionRule = (typeof EXECUTION_RULES)[number];
