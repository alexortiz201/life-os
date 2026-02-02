import { z } from "zod";
import { TrustLevelSchema } from "#/domain/trust/trust.schemas";

/**
 * Canonical shapes
 */
const ArtifactEffectSchema = z.object({
  effectType: z.literal("ARTIFACT"),
  objectId: z.string().min(1), // id of the produced meaning object (note/report/etc.)
  kind: z.string().min(1), // NOTE, REPORT, ARTIFACT, etc. (tighten later)
  trust: TrustLevelSchema,
});

const EventEffectSchema = z.object({
  effectType: z.literal("EVENT"),
  eventName: z.string().min(1), // e.g. "INGESTION_COMPLETED"
  payload: z.unknown().optional(), // keep flexible for now
  trust: TrustLevelSchema,
  // Optional: if you want linkage/audit correlation without requiring it yet
  // eventId: z.string().min(1).optional(),
});

const UnknownEffectSchema = z.object({
  effectType: z.literal("UNKNOWN"),
  trust: TrustLevelSchema,
  raw: z.unknown().optional(),
});

/**
 * Legacy support:
 * Your current producedEffects look like: { objectId, kind, trust }
 * We'll treat those as ARTIFACT effects.
 */
const LegacyArtifactEffectSchema = z.object({
  objectId: z.string().min(1),
  kind: z.string().min(1),
  trust: TrustLevelSchema,
});

/**
 * Exported schema:
 * - Accepts canonical ARTIFACT/EVENT effects
 * - Also accepts legacy artifact effects and normalizes them to canonical ARTIFACT
 */
export const EffectSchema = z.preprocess(
  (val) => {
    // If it's legacy artifact shape, upgrade it in-place.
    const legacy = LegacyArtifactEffectSchema.safeParse(val);
    if (legacy.success) {
      return {
        effectType: "ARTIFACT",
        ...legacy.data,
      };
    }
    return val;
  },
  z.discriminatedUnion("effectType", [
    ArtifactEffectSchema,
    EventEffectSchema,
    UnknownEffectSchema,
  ]),
);
