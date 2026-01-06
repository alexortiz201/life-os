import { z } from "zod";

import { EffectSchema } from "#types/domain/effects/effects.schema";
import { RevalidationCommitDirectiveSchema } from "#types/rna/pipeline/ingestion/revalidation/revalidation.schemas";

const ExecutionEffectsLogSchema = z.object({
  effectsLogId: z.string().min(1),
  proposalId: z.string().min(1),
  producedEffects: z.array(EffectSchema),
});

export const CommitInputSchema = z.object({
  proposalId: z.string().min(1),
  revalidation: RevalidationCommitDirectiveSchema,
  effectsLog: ExecutionEffectsLogSchema,
});
