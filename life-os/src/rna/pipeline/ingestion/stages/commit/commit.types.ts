import z from "zod";

import type {
  EffectDecisionModeOrUnknown,
  GuardResult,
  StageGuardTrace,
} from "#/platform/pipeline/pipeline.types";
import type { PipelineStageFn } from "#/platform/pipeline/stage/stage.types";
import type {
  ArtifactEffect,
  EventEffect,
  UnknownEffect,
} from "#/domain/effects/effects.types";

import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";
import type {
  ProducedEffectSchema,
  RejectedArtifactEffectSchema,
  RejectedEffectSchema,
  RejectedEventEffectSchema,
} from "#/rna/pipeline/ingestion/ingestion.schemas";
import {
  COMMIT_RULES,
  STAGE,
} from "#/rna/pipeline/ingestion/stages/commit/commit.const";
import {
  CommitGuardOutputSchema,
  CommitInputSchema,
  CommitSchema,
} from "#/rna/pipeline/ingestion/stages/commit/commit.schemas";

export type CommitRule = (typeof COMMIT_RULES)[number];

export type Commit = z.infer<typeof CommitSchema>;
export type CommitInput = z.infer<typeof CommitInputSchema>;
export type CommitGuardOutput = z.infer<typeof CommitGuardOutputSchema>;

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

export type CommitErrorCode =
  | "INVALID_COMMIT_INPUT"
  | "COMMIT_PREREQ_MISSING"
  | "PARTIAL_NOT_ALLOWED";

export type CommitGuardErrorCode =
  | "INVALID_COMMIT_INPUT"
  | "COMMIT_INPUT_MISMATCH"
  | "COMMIT_OUTCOME_UNSUPPORTED"
  | "ALLOWLIST_UNKNOWN_OBJECT";

export type ProducedEffect = z.infer<typeof ProducedEffectSchema>;
export type RejectedEffect = z.infer<typeof RejectedEffectSchema>;
export type RejectedArtifactEffect = z.infer<
  typeof RejectedArtifactEffectSchema
>;

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
    artifacts: z.infer<typeof RejectedArtifactEffectSchema>[];
    events: z.infer<typeof RejectedEventEffectSchema>[];
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

export type CommitStage = PipelineStageFn<
  IngestionPipelineEnvelope,
  typeof STAGE,
  CommitErrorCode
>;
