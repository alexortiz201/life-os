import { EnvelopeStage } from "#/types/rna/envelope/envelope.types";
import { IngestionPipelineEnvelope } from "../ingestion/ingestion.types";

export type SchemaParseParams<TEnv = IngestionPipelineEnvelope> = {
  env: TEnv;
  ids: any;
  stages: any;
  proposalId: string;
};

type GuardError<
  TStage extends EnvelopeStage,
  TCode extends string,
  TRule extends string,
  TTrace
> = {
  ok: false;
  code: TCode;
  stage: TStage;
  message: string;
  trace: TTrace & { mode: "UNKNOWN"; rulesApplied: TRule[] };
};

type GuardOk<TData> = { ok: true; data: TData };

export type GuardResult<
  TStage extends EnvelopeStage,
  TCode extends string,
  TRule extends string,
  TTrace,
  TData
> = GuardOk<TData> | GuardError<TStage, TCode, TRule, TTrace>;
