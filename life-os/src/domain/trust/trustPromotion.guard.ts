import { z } from "zod"
import { TRUST_RANK } from "#/domain/trust/trust.constants"
import { TrustLevelSchema } from "#/domain/trust/trust.schemas"

import { PipelineStageSchema } from "#/platform/pipeline/pipeline.schemas"
import type { PipelineStage } from "#/platform/pipeline/pipeline.types"

const TrustPromotionRequestSchema = z.object({
	from: TrustLevelSchema,
	to: TrustLevelSchema,
	stage: PipelineStageSchema,
	reason: z.string().min(1),
})

export type TrustPromotionRequest = z.infer<typeof TrustPromotionRequestSchema>

export type TrustPromotionResult =
	| { ok: true }
	| { ok: false; code: string; message: string }

// Core policy: who can do what
function canPromoteToCommitted(stage: PipelineStage) {
	return stage === "COMMIT"
}

export function guardTrustPromotion(input: unknown): TrustPromotionResult {
	const parsed = TrustPromotionRequestSchema.safeParse(input)
	if (!parsed.success) {
		return {
			ok: false,
			code: "INVALID_REQUEST",
			message: parsed.error.message,
		}
	}

	const { from, to, stage } = parsed.data

	// 1) No-op promotions are suspicious (optional, but good hygiene)
	if (from === to) {
		return {
			ok: false,
			code: "NO_OP",
			message: "Trust promotion must change trust level.",
		}
	}

	// 2) Disallow trust going backwards in this minimal version
	if (TRUST_RANK[to] < TRUST_RANK[from]) {
		return {
			ok: false,
			code: "TRUST_DOWNGRADE_FORBIDDEN",
			message: `Cannot downgrade trust from ${from} to ${to} in promotion guard.`,
		}
	}

	// 3) The big invariant: COMMITTED can only be created by COMMIT
	if (to === "COMMITTED" && !canPromoteToCommitted(stage)) {
		return {
			ok: false,
			code: "COMMIT_STAGE_REQUIRED",
			message: "Only COMMIT stage may promote to COMMITTED trust.",
		}
	}

	return { ok: true }
}
