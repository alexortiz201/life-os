import { z } from "zod"
import {
	ArtifactEffectSchema,
	EventEffectSchema,
} from "#/domain/effects/effects.schemas"
import { OutboxEntryOpaqueSchema } from "#/platform/outbox/outbox.schemas"
import {
	CommitOutcomeSchema,
	EffectDecisionModeSchema,
} from "#/platform/pipeline/pipeline.schemas"
import {
	ApprovedEffectSchema,
	IgnoredEffectSchema,
	RejectedArtifactEffectSchema,
	RejectedEffectSchema,
	RejectedEventEffectSchema,
	TrustPromotionRecordSchema,
} from "#/rna/pipeline/ingestion/ingestion.schemas"
import { ExecutionEffectsLogSchema } from "#/rna/pipeline/ingestion/stages/execution/execution.schemas"
import { RevalidationSchema } from "#/rna/pipeline/ingestion/stages/revalidation/revalidation.schemas"
import { COMMIT_RULES } from "./commit.const"

export const CommitInputSchema = z.object({
	proposalId: z.string().min(1),
	revalidation: RevalidationSchema,
	effectsLog: ExecutionEffectsLogSchema,
})

const InputSchema = z.object({
	commitId: z.string().min(1),
	proposalId: z.string().min(1),
	allowListCount: z.number(),
})

const CommitRuleSchema = z.enum(COMMIT_RULES)
const JustificationSchema = z.object({
	mode: EffectDecisionModeSchema,
	rulesApplied: z.array(CommitRuleSchema),
	inputs: z.array(InputSchema).default([]),
	notes: z.array(z.string()).default([]).optional(),
})

export const CommitSchema = z.object({
	commitId: z.string().min(1),
	proposalId: z.string().min(1),
	promotions: z.array(TrustPromotionRecordSchema).default([]),
	justification: JustificationSchema,
	effects: z.object({
		approved: z.array(ApprovedEffectSchema).default([]),
		rejected: z.array(RejectedEffectSchema).default([]),
		ignored: z.array(IgnoredEffectSchema).default([]),
	}),
	outcome: CommitOutcomeSchema,
	outbox: z.array(OutboxEntryOpaqueSchema).default([]),
})

export const CommitGuardOutputSchema = z.object({
	mode: EffectDecisionModeSchema,
	proposalId: z.string().min(1),
	effectsLogId: z.string().min(1),
	allowListCount: z.number().default(0),

	effects: z.object({
		eligible: z.object({
			artifacts: z.array(ArtifactEffectSchema).default([]),
			events: z.array(EventEffectSchema).default([]),
		}),
		rejected: z.object({
			artifacts: z.array(RejectedArtifactEffectSchema).default([]),
			events: z.array(RejectedEventEffectSchema).default([]),
		}),
		ignored: z.object({
			artifacts: z.array(ArtifactEffectSchema).default([]),
			events: z.array(EventEffectSchema).default([]),
			unknown: z.array(IgnoredEffectSchema).default([]),
		}),
	}),
	rulesApplied: z.array(CommitRuleSchema),
	outcome: CommitOutcomeSchema,
})
