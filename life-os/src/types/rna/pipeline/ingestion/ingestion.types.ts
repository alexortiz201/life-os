import { Effect } from "#/types/domain/effects/effects.types";
import {
  PipelineEnvelope,
  PipelineStage,
  PipelineStageError,
} from "#/types/rna/pipeline/pipeline.types";
import { CommitRecord } from "#/types/rna/pipeline/ingestion/commit/commit.types";
import {
  CommitPolicy,
  RevalidationDirectiveReady,
} from "#/types/rna/pipeline/ingestion/revalidation/revalidation.types";

/**
 * Canonical IDs carried by the envelope.
 * Some are produced incrementally by stages.
 */
type EnvelopeIds = {
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
type IntakeStageOutput = StageResult<{ intakeId: string }, IntakeObservedIds>;

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
  { revalidationId: string } & RevalidationDirectiveReady,
  ObservedIds<"effectsLogId">
>;

type CommitStageOutput = StageResult<
  CommitRecord,
  ObservedIds<"revalidationId" | "effectsLogId">
>;

type IngestionStages = {
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
type PipelineStageErrorSeverity = "HALT" | "WARN";
type PipelineStageName = PipelineStage | "ENVELOPE";

type IngestionMeta = Partial<{
  // convenience mirrors only (optional)
  commitPolicy: { allowedModes: ["FULL"] | ["FULL", "PARTIAL"] };
}>;

export type IngestionPipelineEnvelope = PipelineEnvelope<
  EnvelopeIds,
  IngestionStages,
  PipelineStageError<PipelineStageName, PipelineStageErrorSeverity>,
  IngestionMeta
>;
