import z from "zod";

import { ActorSchema } from "#/types/domain/actors/actors.schemas";
import {
  ArtifactBaseSchema,
  IsoTimestampSchema,
} from "#/types/domain/artifacts/artifacts.schemas";
import {
  REVERSIBILITY_CLAIM,
  IMPACT,
} from "#/types/domain/proposals/proposals.const";
import { makeScopeSchema } from "#/types/domain/scopes/scopes.schemas";

export const ReversibilityClaimSchema = z.enum(REVERSIBILITY_CLAIM);
export const ImpactClaimSchema = z.enum(IMPACT);
export const makeRawProposalSchema = <T extends z.ZodTypeAny>(KindSchema: T) =>
  z.object({
    intent: z.string().min(1),
    actor: ActorSchema,
    target: z.object({
      entity: z.string().min(1),
      scope: makeScopeSchema(KindSchema),
      selector: z.string().min(1).optional(),
    }),
    dependencies: z.array(z.string()).optional().default([]),
    impact: ImpactClaimSchema,
    reversibilityClaim: ReversibilityClaimSchema,
  });

export const makeProposalSchema = <T extends z.ZodTypeAny>(KindSchema: T) =>
  z.object({
    intent: z.string().min(1),
    actor: ActorSchema,
    target: z.object({
      entity: z.string().min(1),
      scope: makeScopeSchema(KindSchema),
      selector: z.string().min(1).optional(),
    }),
    dependencies: z.array(z.string()).optional().default([]),
    impact: ImpactClaimSchema,
    reversibilityClaim: ReversibilityClaimSchema,
  });

const RawProposalSchema = z.string().min(1);
const ProposalIdSchema = z.string().min(1);

export const ProposalRecordSchema = ArtifactBaseSchema.extend({
  kind: z.literal("PROPOSAL_RECORD"),
  trust: z.literal("UNTRUSTED"),

  proposalId: ProposalIdSchema,
  // normalized: RawProposalSchema,
  fingerprint: z.string().min(1),
  intakeTimestamp: IsoTimestampSchema,
  rawProposal: z.unknown(),
});
export type ProposalRecord = z.infer<typeof ProposalRecordSchema>;
