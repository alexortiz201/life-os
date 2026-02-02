import z from "zod";

import type {
  EffectDecisionMode,
  EffectDecisionModeOrUnknown,
  GuardResult,
  StageGuardTrace,
} from "#/platform/pipeline/pipeline.types";
import type {
  ArtifactEffect,
  IgnoredEffect,
  EventEffect,
  UnknownEffect,
} from "#/domain/effects/effects.types";
import type { TrustLevel } from "#/domain/trust/trust.types";

import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";
import { COMMIT_RULES } from "#/rna/pipeline/ingestion/stages/commit/commit.const";
import { CommitInputSchema } from "#/rna/pipeline/ingestion/stages/commit/commit.schemas";
import { CommitOutcome } from "#/rna/pipeline/ingestion/stages/commit/commitDecision.constants";

export type CommitRule = (typeof COMMIT_RULES)[number];

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
  rulesApplied: CommitRule[];
  inputs: Array<{
    commitId: string;
    proposalId: string;
    allowListCount: number;
  }>;
  notes?: Array<Note>;
};

export type Commit = {
  commitId: string;
  proposalId: string;
  promotions: Array<TrustPromotionRecord>;
  justification: Justification;
  effects: {
    approved: Array<ApprovedEffect>;
    rejected: Array<RejectedEffect>;
    ignored: Array<IgnoredEffect>;
  };
  outcome: CommitOutcome;
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
  rulesApplied: CommitRule[];
  outcome: CommitOutcome;
};

export type CommitTrace = StageGuardTrace<
  EffectDecisionModeOrUnknown,
  CommitRule
> &
  Partial<{
    revalidationDeclaredProposalId: string;
    effectsLogDeclaredProposalId: string;
    effectsLogId: string;
    allowListCount: number;
  }>;

export type GuardCommitResult = GuardResult<CommitGuardOutput, CommitTrace>;
// export type GuardCommitResult =
//   | { ok: true; data: CommitGuardOutput }
//   | {
//       ok: false;
//       stage: typeof STAGE; // "COMMIT"
//       code: CommitGuardErrorCode; // <-- union, NOT string
//       message: string;
//       trace: unknown; // or your trace type
//     };

export type CommitErrorCode =
  | "INVALID_COMMIT_INPUT"
  | "COMMIT_PREREQ_MISSING"
  | "PARTIAL_NOT_ALLOWED";

export type CommitGuardErrorCode =
  | "INVALID_COMMIT_INPUT"
  | "COMMIT_INPUT_MISMATCH"
  | "COMMIT_OUTCOME_UNSUPPORTED"
  | "ALLOWLIST_UNKNOWN_OBJECT";

export type ProducedEffect = ArtifactEffect | EventEffect | UnknownEffect;

export type GroupedEffects = {
  all: {
    artifactIds: string[];
    eventNames: string[];
  };
  provisional: {
    artifacts: ArtifactEffect[];
    events: EventEffect[];
  };
  rejected: {
    artifacts: RejectedEffect[];
    events: RejectedEffect[];
  };
  other: {
    artifacts: ArtifactEffect[];
    events: EventEffect[];
    unknown: UnknownEffect[];
  };
};

export type PostGuardCommitInput = {
  env: IngestionPipelineEnvelope;
  data: CommitInput;
};
