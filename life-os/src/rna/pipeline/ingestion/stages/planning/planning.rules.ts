export const PLANNING_RULES = ["PARSE_FAILED", "DRIFT_DETECTED"] as const;

export type PlanningRule = (typeof PLANNING_RULES)[number];
