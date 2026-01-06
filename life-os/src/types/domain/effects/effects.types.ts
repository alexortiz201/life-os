import type { z } from "zod";
import type { EffectSchema } from "./effects.schema";

export type Effect = z.infer<typeof EffectSchema>;

export type ArtifactEffect = Extract<Effect, { effectType: "ARTIFACT" }>;
export type EventEffect = Extract<Effect, { effectType: "EVENT" }>;
