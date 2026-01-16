import type {
  Effect,
  ArtifactEffect,
} from "#/types/domain/effects/effects.types";

export function isArtifactEffect(e: Effect): e is ArtifactEffect {
  return e.effectType === "ARTIFACT";
}

export function isProvisionalArtifactEffect(e: Effect): e is ArtifactEffect {
  return e.effectType === "ARTIFACT" && e.trust === "PROVISIONAL";
}
