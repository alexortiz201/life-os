import { z } from "zod";

import { EffectSchema } from "#/domain/effects/effects.schema";
import { CommitPolicySchema } from "#/rna/pipeline/ingestion/validation/validation.schemas";

export const ExecutionEffectsLogSchema = z.object({
  effectsLogId: z.string().min(1),
  proposalId: z.string().min(1),
  producedEffects: z.array(EffectSchema),
});

export const ExecutionInputSchema = z.object({
  proposalId: z.string().min(1),
  snapshotId: z.string().min(1),
  validationDecision: z.string().min(1),
  planningId: z.string().min(1),
  plan: z.string().array().default([]),
  commitPolicy: CommitPolicySchema,
});
