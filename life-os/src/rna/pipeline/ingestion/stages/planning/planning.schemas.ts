import { z } from "zod";

import { CommitPolicySchema } from "#/rna/pipeline/ingestion/stages/validation/validation.schemas";
import { PLAN_KINDS } from "./planning.const";

const PlanStepSchema = z.object({
  stepId: z.string().min(1),
  kind: z.enum(PLAN_KINDS),
  description: z.string().min(1),
  outputs: z
    .object({
      artifacts: z.array(z.object({ kind: z.string().min(1) })).default([]),
      events: z.array(z.object({ name: z.string().min(1) })).default([]),
    })
    .default({ artifacts: [], events: [] }),
});

export const PlanSchema = z.array(PlanStepSchema).default([]);

export const PlanningSchema = z.object({
  planningId: z.string().min(1),
  plan: PlanSchema,
  fingerprint: z.string().min(1),
});

export const PlanningInputSchema = z.object({
  proposalId: z.string().min(1),
  snapshotId: z.string().min(1),
  validationDecision: z.string().min(1),
  planningId: z.string().min(1),
  plan: PlanSchema,
  commitPolicy: CommitPolicySchema,
});
