import * as E from "fp-ts/Either";

import type {
  PipelineStageErrorSeverity,
  PipelineStageName,
} from "#/rna/pipeline/ingestion/ingestion.types";
import type { HasErrors } from "#/rna/envelope/envelope-utils";
import type { PipelineStageError } from "#/platform/pipeline/pipeline.types";

import type { StageLeft } from "./stage.types";

export function stageLeft<
  TEnv extends HasErrors<PipelineStageError<any, any, any>>,
  TStage extends PipelineStageName,
  TCode extends string,
  TSeverity extends PipelineStageErrorSeverity = "HALT",
>(params: {
  env: TEnv;
  stage: TStage;
  code: TCode;
  severity?: TSeverity;
  message: string;
  trace?: unknown;
  at?: number;
  appendError: (
    env: TEnv,
    err: PipelineStageError<TStage, TSeverity, TCode>,
  ) => TEnv;
}): E.Either<StageLeft<TEnv, TStage, TCode>, never> {
  const at = params.at ?? Date.now();

  const nextEnv = params.appendError(params.env, {
    stage: params.stage,
    severity: (params.severity ?? "HALT") as TSeverity,
    code: params.code,
    message: params.message,
    trace: params.trace,
    at,
  });

  const error = nextEnv.errors[nextEnv.errors.length - 1] as PipelineStageError<
    TStage,
    PipelineStageErrorSeverity,
    TCode
  >;

  return E.left({ env: nextEnv, error });
}

export function leftFromLastError<
  TEnv extends HasErrors<PipelineStageError<any, any, any>>,
  TStage extends PipelineStageName,
  TCode extends string,
>(env: TEnv): E.Either<StageLeft<TEnv, TStage, TCode>, never> {
  const error = env.errors.at(-1);
  if (!error) throw new Error("leftFromLastError: env.errors is empty");

  return E.left({
    env,
    error: error as PipelineStageError<
      TStage,
      PipelineStageErrorSeverity,
      TCode
    >,
  });
}

export const makeStageLeft =
  <TEnv extends HasErrors<any>>(appendError: (env: TEnv, err: any) => TEnv) =>
  <
    TStage extends PipelineStageName,
    TCode extends string,
    TSeverity extends PipelineStageErrorSeverity = "HALT",
  >(params: {
    env: TEnv;
    stage: TStage;
    code: TCode;
    severity?: TSeverity;
    message: string;
    trace?: unknown;
    at?: number;
  }): E.Either<StageLeft<TEnv, TStage, TCode>, never> =>
    stageLeft({
      ...params,
      appendError,
    });
