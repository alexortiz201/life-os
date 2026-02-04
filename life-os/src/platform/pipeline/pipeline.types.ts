import z from "zod";
import type { PIPELINE_STAGES } from "./pipeline.constants";
import * as E from "fp-ts/Either";
import {
  EffectDecisionModeSchema,
  EffectDecisionModeOrUnknownSchema,
} from "./pipeline.schemas";

export type Stage<E, A> = (env: A) => E.Either<E, A>;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type GuardResult<TData, TTrace, TCode extends string = string> =
  | { ok: true; data: TData }
  | { ok: false; code: TCode; message: string; trace: TTrace };

export type StageGuardTrace<
  TMode extends string = string,
  TRule extends string = string,
> = Partial<{
  mode: TMode;
  proposalId: string;
  rulesApplied: TRule[];
}>;

export type PipelineStageError<
  TStageName,
  TStageErrorSeverity,
  TCode extends string = string,
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
  TMeta = {},
> = {
  ids: TIds;
  snapshot: TContextSnapshot;
  stages: TStages;
  errors: TErrors[];
  meta?: TMeta;
};

export type EffectDecisionMode = z.infer<typeof EffectDecisionModeSchema>;
export type EffectDecisionModeOrUnknown = z.infer<
  typeof EffectDecisionModeOrUnknownSchema
>;
