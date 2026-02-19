import { z } from "zod"

import { EffectSchema } from "#/domain/effects/effects.schemas"
import { PlanSchema } from "#/rna/pipeline/ingestion/stages/planning/planning.schemas"
import { CommitPolicySchema } from "#/rna/pipeline/ingestion/stages/validation/validation.schemas"

export const ExecutionEffectsLogSchema = z.object({
	effectsLogId: z.string().min(1),
	proposalId: z.string().min(1),
	producedEffects: z.array(EffectSchema),
	fingerprint: z.string().min(1),
})

export const ExecutionSchema = z.object({
	executionId: z.string().min(1),
	effectsLog: ExecutionEffectsLogSchema,
})

export const ExecutionInputSchema = z.object({
	proposalId: z.string().min(1),
	snapshotId: z.string().min(1),
	validationDecision: z.string().min(1),
	planningId: z.string().min(1),
	plan: PlanSchema,
	commitPolicy: CommitPolicySchema,
})
