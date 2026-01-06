import z from "zod";

import { CommitOutcome } from "#types/rna/pipeline/ingestion/commit/commitDecision.constants";

import { RevalidationCommitDirectiveSchema } from "./revalidation.schemas";

export type AllowedModes = ["FULL"] | ["FULL", "PARTIAL"];

export type CommitPolicy = {
  allowedModes: AllowedModes;
};

export type RevalidationDecision = {
  proposalId: string;
  validationDecisionId: string;
  executionPlanId: string;
  meaningSnapshotId: string;
  commitPolicy: CommitPolicy;
  outcome: CommitOutcome;
};

export type RevalidationCommitDirective = z.infer<
  typeof RevalidationCommitDirectiveSchema
>;
