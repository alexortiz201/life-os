import type { PIPELINE_STAGES } from "./pipeline.constants";
import * as E from "fp-ts/Either";

export type Stage<E, A> = (env: A) => E.Either<E, A>;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type EffectDecisionMode = "FULL" | "PARTIAL";
export type EffectDecisionModeOrUnknown = EffectDecisionMode | "UNKNOWN";

export type GuardResult<TData, TTrace, TCode extends string = string> =
  | { ok: true; data: TData }
  | { ok: false; code: TCode; message: string; trace: TTrace };

export type StageGuardTrace<
  TMode extends string = string,
  TRule extends string = string
> = Partial<{
  mode: TMode;
  proposalId: string;
  rulesApplied: TRule[];
}>;

// type StageErrorCode =
//   | "INVALID_COMMIT_INPUT"
//   | "COMMIT_PREREQ_MISSING"
//   | "PARTIAL_NOT_ALLOWED"
//   | ...;

export type PipelineStageError<
  TStageName,
  TStageErrorSeverity,
  TCode extends string = string
> = {
  stage: TStageName;
  severity: TStageErrorSeverity;
  code: TCode;
  message: string;
  trace?: unknown;
  at: number;
};

export type PipelineEnvelope<
  TIds,
  TContextSnapshot,
  TStages,
  TErrors,
  TMeta = {}
> = {
  ids: TIds;
  snapshot: TContextSnapshot;
  stages: TStages;
  errors: TErrors[];
  meta?: TMeta;
};
