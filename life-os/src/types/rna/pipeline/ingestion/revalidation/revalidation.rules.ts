export const REVALIDATION_RULES = ["DRIFT_DETECTED"] as const;

export type RevalidationRule = (typeof REVALIDATION_RULES)[number];
