import { z } from "zod";

import { CommitPolicySchema } from "#/rna/pipeline/ingestion/validation/validation.schemas";

export const PlanningSchema = z.object({
  planningId: z.string().min(1),
  proposalId: z.string().min(1),
  plan: z.string().array().default([]),
});

export const PlanningInputSchema = z.object({
  proposalId: z.string().min(1),
  snapshotId: z.string().min(1),
  validationDecision: z.string().min(1),
  planningId: z.string().min(1),
  plan: z.string().array().default([]),
  commitPolicy: CommitPolicySchema,
});
