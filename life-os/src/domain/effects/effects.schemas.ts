import { z } from "zod"
import { TrustLevelSchema } from "#/domain/trust/trust.schemas"

/**
 * Canonical shapes
 */
export const ArtifactEffectSchema = z.object({
	stableId: z.string().min(1), // deterministic id
	effectType: z.literal("ARTIFACT"),
	objectId: z.string().min(1), // id of the produced meaning object (note/report/etc.)
	kind: z.string().min(1), // NOTE, REPORT, ARTIFACT, etc. (tighten later)
	trust: TrustLevelSchema,
})

export const EventEffectSchema = z.object({
	stableId: z.string().min(1), // deterministic id
	effectType: z.literal("EVENT"),
	eventName: z.string().min(1), // e.g. "INGESTION_COMPLETED"
	payload: z.unknown().optional(), // keep flexible for now
	trust: TrustLevelSchema,
	// Optional: if you want linkage/audit correlation without requiring it yet
	// eventId: z.string().min(1).optional(),
})

export const UnknownEffectSchema = z.object({
	stableId: z.string().min(1), // deterministic id
	effectType: z.literal("UNKNOWN"),
	trust: TrustLevelSchema,
	raw: z.unknown().optional(),
})

/**
 * Exported schema:
 * - Accepts canonical ARTIFACT/EVENT effects
 */
export const EffectSchema = z.discriminatedUnion("effectType", [
	ArtifactEffectSchema,
	EventEffectSchema,
	UnknownEffectSchema,
])
