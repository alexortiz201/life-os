import { z } from "zod";

import { COMMIT_OUTCOMES } from "#/rna/pipeline/ingestion/stages/commit/commitDecision.constants";

import { CommitPolicySchema } from "#/rna/pipeline/ingestion/stages/validation/validation.schemas";
import { ExecutionEffectsLogSchema } from "#/rna/pipeline/ingestion/stages/execution/execution.schemas";
import { PlanSchema } from "#/rna/pipeline/ingestion/stages/planning/planning.schemas";

export const RevalidationCommitDirectiveSchema = z.object({
  proposalId: z.string().min(1),
  outcome: z.enum(COMMIT_OUTCOMES),
  commitAllowList: z.string().array().default([]),
  rulesApplied: z.string().array().default([]),
});

export const RevalidationInputSchema = z.object({
  proposalId: z.string().min(1),
  snapshotId: z.string().min(1),
  planningId: z.string().min(1),
  executionId: z.string().min(1),

  validationDecision: z.string().min(1),
  plan: PlanSchema,
  commitPolicy: CommitPolicySchema,
  effectsLog: ExecutionEffectsLogSchema,
});

export const RevalidationSchema = z.object({
  proposalId: z.string().min(1),
  revalidationId: z.string().min(1),
  directive: RevalidationCommitDirectiveSchema,
});
