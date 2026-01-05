import { z } from "zod";
import { TrustLevelSchema } from "#/domain/trust/trust.schemas";

export const ProducedEffectSchema = z.object({
  objectId: z.string().min(1),
  kind: z.string().min(1), // NOTE, REPORT, ARTIFACT, etc (we'll tighten later)
  trust: TrustLevelSchema,
});

const ExecutionEffectsLogSchema = z.object({
  effectsLogId: z.string().min(1),
  proposalId: z.string().min(1),
  producedEffects: z.array(ProducedEffectSchema),
});

const RevalidationDecisionSchema = z.object({
  proposalId: z.string().min(1),
  outcome: z.enum(["APPROVE_COMMIT", "PARTIAL_COMMIT", "REJECT_COMMIT"]),
  commitAllowList: z.string().array().default([]),
});

export const CommitInputSchema = z.object({
  proposalId: z.string().min(1),
  revalidation: RevalidationDecisionSchema,
  effectsLog: ExecutionEffectsLogSchema,
});
