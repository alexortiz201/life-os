import { z } from "zod";

import { COMMIT_OUTCOMES } from "#/types/rna/pipeline/ingestion/commit/commitDecision.constants";

import { CommitPolicySchema } from "#/types/rna/pipeline/ingestion/validation/validation.schemas";
import { ExecutionEffectsLogSchema } from "#/types/rna/pipeline/ingestion/execution/execution.schemas";

export const RevalidationCommitDirectiveSchema = z.object({
  proposalId: z.string().min(1),
  outcome: z.enum(COMMIT_OUTCOMES),
  commitAllowList: z.string().array().default([]),
  rulesApplied: z.string().array().default([]),
});

export const RevalidationInputSchema = z.object({
  proposalId: z.string().min(1),
  snapshotId: z.string().min(1),
  validationDecision: z.string().min(1),
  executionplanningId: z.string().min(1),
  executionPlan: z.string().array().default([]),
  executionResult: z.string().array().default([]),
  commitPolicy: CommitPolicySchema,
  effectsLog: ExecutionEffectsLogSchema,
});
