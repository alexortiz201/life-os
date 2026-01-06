export type AllowedModes = ["FULL"] | ["FULL", "PARTIAL"];

export type CommitPolicy = {
  allowedModes: AllowedModes;
};

export type RevalidationDecision = {
  proposalId: string;
  validationDecisionId: string;
  executionPlanId: string;
  // meaningSnapshotId: string;
  commitPolicy: CommitPolicy;
  outcome: "";
};
