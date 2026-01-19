import type { PIPELINE_STAGES } from "./pipeline.constants";

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

export type PipelineStageError<TStageName, TStageErrorSeverity> = {
  stage: TStageName;
  severity: TStageErrorSeverity;
  code: string;
  message: string;
  trace?: unknown;
  at: number; // timestamp
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
