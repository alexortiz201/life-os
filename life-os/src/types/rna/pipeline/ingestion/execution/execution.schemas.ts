import { z } from "zod";

import { EffectSchema } from "#types/domain/effects/effects.schema";

export const ExecutionEffectsLogSchema = z.object({
  effectsLogId: z.string().min(1),
  proposalId: z.string().min(1),
  producedEffects: z.array(EffectSchema),
});
