import z from "zod";

import type {
  EffectDecisionMode,
  EffectDecisionModeOrUnknown,
  GuardResult,
  StageGuardTrace,
} from "#/types/rna/pipeline/pipeline.types";
import type {
  ArtifactEffect,
  IgnoredEffect,
  EventEffect,
  UnknownEffect,
} from "#/types/domain/effects/effects.types";
import type { TrustLevel } from "#/types/domain/trust/trust.types";
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

type RejectedEffectKey =
  | { effectType: "ARTIFACT"; objectId: string; kind: string }
  | { effectType: "EVENT"; eventName: string };

export type RejectedEffect = RejectedEffectKey & {
  trust: TrustLevel;
  originalTrust: TrustLevel;
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
  justification: Justification;
  effects: {
    approved: Array<ApprovedEffect>;
    rejected: Array<RejectedEffect>;
    ignored: Array<IgnoredEffect>;
  };
};

export type CommitInput = z.infer<typeof CommitInputSchema>;

export type CommitGuardOutput = {
  mode: EffectDecisionMode;
  proposalId: string;
  effectsLogId: string;
  allowListCount: number;
  effects: {
    eligible: {
      artifacts: Array<ArtifactEffect>;
      events: Array<EventEffect>;
    };
    rejected: {
      artifacts: Array<RejectedEffect>;
      events: Array<RejectedEffect>;
    };
    ignored: {
      artifacts: Array<ArtifactEffect>;
      events: Array<EventEffect>;
      unknown: Array<IgnoredEffect>;
    };
  };
  rulesApplied: PrecommitRule[];
};

export type CommitTrace = StageGuardTrace<
  EffectDecisionModeOrUnknown,
  PrecommitRule
> &
  Partial<{
    revalidationDeclaredProposalId: string;
    effectsLogDeclaredProposalId: string;
    effectsLogId: string;
    allowListCount: number;
  }>;

export type GuardCommitResult = GuardResult<CommitGuardOutput, CommitTrace>;
