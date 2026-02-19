import type { z } from "zod"

// biome-ignore lint/style/useImportType: schemas used in `typeof` for type derivation
import { EffectSchema } from "./effects.schemas"

export type Effect = z.infer<typeof EffectSchema>
export type ArtifactEffect = Extract<Effect, { effectType: "ARTIFACT" }>
export type EventEffect = Extract<Effect, { effectType: "EVENT" }>
export type UnknownEffect = Extract<Effect, { effectType: "UNKNOWN" }>

// catch all for for anything unaccounted
// ArtifactEffect | EventEffect - should always either get approved or rejected
export type IgnoredEffect = ArtifactEffect | EventEffect | UnknownEffect
