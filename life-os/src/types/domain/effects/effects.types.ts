import type { z } from "zod";
import type { EffectSchema } from "./effects.schema";
import { TrustLevel } from "../trust/trust.types";

export type Effect = z.infer<typeof EffectSchema>;

export type EffectKey =
  | {
      effectType: "ARTIFACT";
      trust: TrustLevel;
      objectId: string;
      kind: string;
    }
  | { effectType: "EVENT"; trust: TrustLevel; eventName: string }
  | { effectType: "UNKNOWN"; trust: TrustLevel; raw?: unknown };

export type EffectDispositionBase = EffectKey;
/* & {
  reasonCode: "UNSUPPORTED_EFFECT_TYPE";
  reason: "Effect currently not handled";
}; */

export type ArtifactEffect = Extract<Effect, { effectType: "ARTIFACT" }>;
export type EventEffect = Extract<Effect, { effectType: "EVENT" }>;
export type UnknownEffect = Extract<Effect, { effectType: "UNKNOWN" }>;
