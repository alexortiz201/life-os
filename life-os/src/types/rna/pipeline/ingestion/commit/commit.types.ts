import z from "zod";

import type {
  EffectDecisionMode,
  EffectDecisionModeOrUnknown,
  GuardResult,
  StageGuardTrace,
} from "#types/rna/pipeline/pipeline.types";
import type { ArtifactEffect } from "#types/domain/effects/effects.types";
import type { TrustLevel } from "#types/domain/trust/trust.types";
import type { PrecommitRule } from "./commit.rules";
import { CommitInputSchema } from "./commit.schemas";

export type TrustPromotionRecord = {
  objectId: string;
  from: "PROVISIONAL";
  to: "COMMITTED";
  stage: "COMMIT";
  reason: string;
  proposalId: string;
  effectsLogId: string;
  commitId: string;
};

type Note = any;

export type ApprovedEffect = {
  objectId: string;
  kind: string;
  trust: "COMMITTED";
};

export type RejectedEffect = {
  objectId: string;
  kind: string;
  originalTrust: TrustLevel;
  trust: TrustLevel;
  reasonCode: string;
  reason: string;
};

export type Justification = {
  mode: EffectDecisionMode;
  rulesApplied: PrecommitRule[];
  inputs: Array<{
    commitId: string;
    proposalId: string;
    allowListCount: number;
  }>;
  notes?: Array<Note>;
};

export type CommitRecord = {
  commitId: string;
  proposalId: string;
  promotions: Array<TrustPromotionRecord>;
  approvedEffects: Array<ApprovedEffect>;
  rejectedEffects: Array<RejectedEffect>;
  justification: Justification;
};

export type CommitInput = z.infer<typeof CommitInputSchema>;

export type CommitReady = {
  proposalId: string;
  effectsLogId: string;
  mode: EffectDecisionMode;
  commitEligibleEffects: Array<ArtifactEffect>;
  allowListCount: number;
  rulesApplied: PrecommitRule[];
  rejectedEffects: Array<RejectedEffect>;
};

export type PrecommitTrace = StageGuardTrace<
  EffectDecisionModeOrUnknown,
  PrecommitRule
> &
  Partial<{
    revalidationDeclaredProposalId: string;
    effectsLogDeclaredProposalId: string;
    effectsLogId: string;
    allowListCount: number;
  }>;

export type GuardPrecommitResult = GuardResult<CommitReady, PrecommitTrace>;
