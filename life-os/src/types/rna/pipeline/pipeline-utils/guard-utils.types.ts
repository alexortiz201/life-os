import { EnvelopeStage } from "#/rna/envelope/envelope.types";
import { IngestionPipelineEnvelope } from "../ingestion/ingestion.types";

export type SchemaParseParams<TEnv = IngestionPipelineEnvelope> = {
  env: TEnv;
  ids: any;
  stages: any;
  proposalId: string;
};

export type GuardTrace<TTrace, TParseRule extends string> = TTrace & {
  rulesApplied: readonly TParseRule[];
  mode?: "UNKNOWN" | string;

  // override-any-default (runtime override fields)
  code?: string;
  stage?: EnvelopeStage;
  message?: string;
} & Record<string, unknown>;

export type GuardError<
  TStage,
  TCode extends string,
  TRule extends string,
  TTrace
> = {
  ok: false;
  stage: TStage;
  code: TCode;
  message: string;
  trace: GuardTrace<TTrace, TRule>;
};

type GuardOk<TData> = { ok: true; data: TData };

export type GuardResult<
  TStage extends EnvelopeStage,
  TCode extends string,
  TRule extends string,
  TTrace,
  TData
> = GuardOk<TData> | GuardError<TStage, TCode, TRule, TTrace>;
