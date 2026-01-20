import type { z } from "zod";

// import { errorResultFactory } from "#/rna/pipelines/pipeline-utils";
// import { appendError } from "#/rna/envelope/envelope-utils";
import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";

import type { EnvelopeStage } from "#/types/rna/envelope/envelope.types";
import { ENVELOPE_STAGE_TO_KEY } from "#/types/rna/envelope/envelope.const";
import { INGESTION_STAGE_DEPS } from "#/types/rna/pipeline/ingestion/ingestion.const";
import {
  GuardResult,
  SchemaParseParams,
} from "#/types/rna/pipeline/pipeline-utils/guard-utils.types";

/**
 * Minimal runtime narrowing so we can safely pluck from `unknown`.
 * (We still Zod-validate the "candidate" as the real contract.)
 */
function isObject(x: unknown): x is Record<string, any> {
  return typeof x === "object" && x !== null;
}

const hasAllDepStages = (STAGE: EnvelopeStage, stages: any | undefined) => {
  if (STAGE === "ENVELOPE") return { ok: false, needsStages: false };

  const depStages = INGESTION_STAGE_DEPS[STAGE].stages;
  const needsStages = depStages.length > 0;

  if (needsStages && !isObject(stages)) {
    return { ok: false, needsStages };
  }

  for (let stage of depStages) {
    const stageKey = ENVELOPE_STAGE_TO_KEY[stage];
    if (!isObject((stages as any)[stageKey])) return { ok: false, needsStages };
  }

  return { ok: true, needsStages };
};

export const guardFactory = <
  TEnv,
  TStage extends EnvelopeStage,
  TCode extends string,
  TParseRule extends string,
  TTrace extends Record<string, any>,
  TSchema extends z.ZodTypeAny
>({
  STAGE,
  InputSchema,
  code,
  parseFailedRule,
  message = "Input invalid",
  pluckParams = (_: SchemaParseParams<TEnv>) => ({}),
}: {
  STAGE: TStage;
  InputSchema: TSchema;
  code: TCode;
  parseFailedRule: TParseRule;
  message?: string;
  pluckParams: (args: SchemaParseParams<TEnv>) => unknown;
}) => {
  type Data = z.infer<TSchema>;

  return (env: TEnv): GuardResult<TStage, TCode, TParseRule, TTrace, Data> => {
    // const error = errorResultFactory<TTrace & { rulesApplied: TParseRule[] }>();
    const error = (
      trace: TTrace & { message?: string; rulesApplied: TParseRule[] }
    ) => ({
      ok: false as const,
      code,
      stage: STAGE,
      message: message ? message : `${STAGE}: Invalid input`,
      trace: { mode: "UNKNOWN" as const, ...trace },
    });

    // 0) Narrow unknown -> object
    if (!isObject(env)) {
      return error({
        rulesApplied: [parseFailedRule],
      } as any);
    }

    const ids = isObject((env as any).ids) ? (env as any).ids : undefined;
    const proposalId =
      typeof ids?.proposalId === "string" ? ids.proposalId : "";
    const stages = isObject((env as any).stages)
      ? (env as any).stages
      : undefined;

    const res = hasAllDepStages(STAGE, stages);

    if (!ids || !proposalId || (res.needsStages && !stages)) {
      return error({
        // ids,
        proposalId,
        rulesApplied: [parseFailedRule],
      } as any);
    }

    if (!res.ok) {
      return error({
        proposalId,
        message: `${STAGE}: Missing prereq stage, invalid input.`,
        rulesApplied: [parseFailedRule],
      } as any);
    }

    // 1) Candidate for schema validation
    const schemaInput = pluckParams({ env, ids, stages, proposalId });
    const parsed = InputSchema.safeParse(schemaInput);

    if (!parsed.success) {
      return error({
        ids,
        message: `${STAGE}: Schema parsing failed, invalid input.`,
        rulesApplied: [parseFailedRule],
      } as any);
    }

    return { ok: true as const, data: parsed.data };
  };
};
