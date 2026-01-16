import type { z } from "zod";
import type { EffectSchema } from "./effects.schema";
import { TrustLevel } from "../trust/trust.types";

export type Effect = z.infer<typeof EffectSchema>;

type EffectKey =
  | {
      effectType: "ARTIFACT";
      trust: TrustLevel;
      objectId: string;
      kind: string;
    }
  | { effectType: "EVENT"; trust: TrustLevel; eventName: string }
  | { effectType: "UNKNOWN"; trust: TrustLevel; raw?: unknown };

export type ArtifactEffect = Extract<Effect, { effectType: "ARTIFACT" }>;
export type EventEffect = Extract<Effect, { effectType: "EVENT" }>;
export type UnknownEffect = Extract<Effect, { effectType: "UNKNOWN" }>;

// catch all for for anything unaccounted
// ArtifactEffect | EventEffect - should always either get approved or rejected
export type IgnoredEffect = ArtifactEffect | EventEffect | UnknownEffect;
