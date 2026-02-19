export const STAGE = "PLANNING" as const
export const PLANNING_RULES = ["PARSE_FAILED", "DRIFT_DETECTED"] as const
export const PLAN_KINDS = ["PRODUCE_ARTIFACT", "EMIT_EVENT"] as const

// export type PlanningRule = (typeof PLANNING_RULES)[number];
// export type PlanKind = (typeof PLAN_KINDS)[number];
