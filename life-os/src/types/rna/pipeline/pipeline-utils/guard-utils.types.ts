import { EnvelopeStage } from "#/types/rna/envelope/envelope.types";
import { IngestionPipelineEnvelope } from "../ingestion/ingestion.types";

export type SchemaParseParams<TEnv = IngestionPipelineEnvelope> = {
  env: TEnv;
  ids: any;
  stages: any;
  proposalId: string;
};

export type GuardTrace<TTrace, TParseRule extends string> = TTrace & {
  mode: "UNKNOWN";
  rulesApplied: readonly TParseRule[];
} & Record<string, unknown>;

export type GuardError<
  TStage,
  TCode extends string,
  TRule extends string,
  TTrace
> = {
  ok: false;
  code: TCode;
  stage: TStage;
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
