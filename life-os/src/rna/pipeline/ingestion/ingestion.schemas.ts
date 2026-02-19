import z from "zod"
import {
	ArtifactEffectSchema,
	EventEffectSchema,
	UnknownEffectSchema,
} from "#/domain/effects/effects.schemas"
import { makePermissionSchema } from "#/domain/permissions/permissions.schemas"
import { TrustLevelSchema } from "#/domain/trust/trust.schemas"

import { INGESTION_ACTIONS } from "./ingestion.const"

export const PermissionSchema = makePermissionSchema(INGESTION_ACTIONS)

export const TrustPromotionRecordSchema = z.object({
	stage: z.literal("COMMIT"),
	objectId: z.string().min(1),
	from: z.literal("PROVISIONAL"),
	to: z.literal("COMMITTED"),
	reason: z.string().min(1),
	proposalId: z.string().min(1),
	effectsLogId: z.string().min(1),
	commitId: z.string().min(1),
})

const BaseRejectedEffectSchema = z.object({
	trust: TrustLevelSchema,
	originalTrust: TrustLevelSchema,
	reasonCode: z.string().min(1),
	reason: z.string().min(1),
})

export const ApprovedEffectSchema = z.object({
	...ArtifactEffectSchema.shape,
	trust: z.literal("COMMITTED"),
})

export const IgnoredEffectSchema = z.discriminatedUnion("effectType", [
	ArtifactEffectSchema,
	EventEffectSchema,
	UnknownEffectSchema,
])

export const RejectedArtifactEffectSchema = z.object({
	...ArtifactEffectSchema.shape,
	...BaseRejectedEffectSchema.shape,
})

export const RejectedEventEffectSchema = z.object({
	...EventEffectSchema.shape,
	...BaseRejectedEffectSchema.shape,
})

/* We only allow artifacts or events effects to get rejected, unknown gets ignored. */
export const RejectedEffectSchema = z.discriminatedUnion("effectType", [
	RejectedArtifactEffectSchema,
	RejectedEventEffectSchema,
])

export const ProducedEffectSchema = z.discriminatedUnion("effectType", [
	ArtifactEffectSchema,
	EventEffectSchema,
	UnknownEffectSchema,
])
