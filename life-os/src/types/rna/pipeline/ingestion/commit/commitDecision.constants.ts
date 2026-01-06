export const COMMIT_OUTCOMES = [
  "APPROVE_COMMIT",
  "PARTIAL_COMMIT",
  "REJECT_COMMIT",
] as const;

export type CommitOutcome = (typeof COMMIT_OUTCOMES)[number];
