import { Effect } from "#/domain/effects/effects.types";
import {
  PipelineEnvelope,
  PipelineStage,
  PipelineStageError,
} from "#/platform/pipeline/pipeline.types";

import { CommitPolicy } from "#/rna/pipeline/ingestion/stages/validation/validation.types";
import { RevalidationGuardOutput } from "#/rna/pipeline/ingestion/stages/revalidation/revalidation.types";
import { CommitRecord } from "#/rna/pipeline/ingestion/stages/commit/commit.types";
import { Permission } from "#/domain/permissions/permissions.types";
import { Kinds } from "#/domain/scopes/scopes.types";
import { ContextSnapshot } from "#/domain/snapshot/snapshot.provider.types";
import { ProposalRecord } from "#/domain/proposals/proposals.schemas";

/**
 * Canonical IDs carried by the envelope.
 * Some are produced incrementally by stages.
 */
export type EnvelopeIds = {
  proposalId: string;
  intakeId?: string;
  validationId?: string;
  planningId?: string;
  executionId?: string;
  effectsLogId?: string;
  revalidationId?: string;
  commitId?: string;
  snapshotId?: string; // meaning snapshot / version
};

/**
 * IDs a stage explicitly observed at runtime.
 * proposalId + snapshotId are always required (except Intake).
 */
type ObservedIds<Req extends keyof EnvelopeIds> = Pick<
  EnvelopeIds,
  "proposalId" | "snapshotId" | Req
> &
  Partial<EnvelopeIds>;

/**
 * Intake is special: snapshot does not yet exist.
 */
type IntakeObservedIds = Omit<ObservedIds<never>, "snapshotId">;

/**
 * Standard stage wrapper.
 */
type StageResult<TStageState, TObservedIds> =
  | { hasRun: false }
  | ({
      hasRun: true;
      ranAt: number;
      observed: TObservedIds;
    } & TStageState);

/* ===========================
   Stage Outputs
   =========================== */
type IntakeStageOutput = StageResult<
  { intakeId: string; proposal: ProposalRecord }, // rawProposal: result.data.rawProposal,
  IntakeObservedIds
>;

type ValidationStageOutput = StageResult<
  { validationId: string; commitPolicy: CommitPolicy },
  ObservedIds<"intakeId">
>;

type PlanningStageOutput = StageResult<
  { planningId: string },
  ObservedIds<"validationId">
>;

type ExecutionStageOutput = StageResult<
  { executionId: string; producedEffects: Effect[] },
  ObservedIds<"planningId">
>;

type RevalidationStageOutput = StageResult<
  { revalidationId: string } & RevalidationGuardOutput,
  ObservedIds<"effectsLogId">
>;

type CommitStageOutput = StageResult<
  CommitRecord,
  ObservedIds<"revalidationId" | "effectsLogId">
>;

export type IngestionStages = {
  intake: IntakeStageOutput;
  validation: ValidationStageOutput;
  planning: PlanningStageOutput;
  execution: ExecutionStageOutput;
  revalidation: RevalidationStageOutput;
  commit: CommitStageOutput;
};

/* ===========================
   Errors & Envelope
   =========================== */
export type PipelineStageErrorSeverity = "HALT" | "WARN";
export type PipelineStageName = PipelineStage | "ENVELOPE";

type IngestionMeta = Partial<{
  // convenience mirrors only (optional)
  commitPolicy: { allowedModes: ["FULL"] | ["FULL", "PARTIAL"] };
}>;

export type IngestionContextSnapshot = ContextSnapshot<Permission, Kinds>;
export type IngestionPipelineEnvelope = PipelineEnvelope<
  EnvelopeIds,
  IngestionContextSnapshot,
  IngestionStages,
  PipelineStageError<PipelineStageName, PipelineStageErrorSeverity>,
  IngestionMeta
>;
