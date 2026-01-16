import type { z } from "zod";

// import { errorResultFactory } from "#/rna/pipelines/pipeline-utils";
import { appendError } from "#/rna/pipelines/envelope-utils";
import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";

import type { EnvelopeStage } from "#/rna/pipelines/envelope-utils";

/**
 * Minimal runtime narrowing so we can safely pluck from `unknown`.
 * (We still Zod-validate the "candidate" as the real contract.)
 */
function isObject(x: unknown): x is Record<string, any> {
  return typeof x === "object" && x !== null;
}

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

type GuardResult<
  TStage extends EnvelopeStage,
  TCode extends string,
  TRule extends string,
  TTrace,
  TData
> = GuardOk<TData> | GuardError<TStage, TCode, TRule, TTrace>;

export const guardFactory = <
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
}: {
  STAGE: TStage;
  InputSchema: TSchema;
  code: TCode;
  parseFailedRule: TParseRule;
  message?: string;
}) => {
  type Data = z.infer<TSchema>;

  return (
    env: IngestionPipelineEnvelope
  ): GuardResult<TStage, TCode, TParseRule, TTrace, Data> => {
    // const error = errorResultFactory<TTrace & { rulesApplied: TParseRule[] }>();
    const error = (trace: TTrace & { rulesApplied: TParseRule[] }) => ({
      ok: false as const,
      code: code,
      stage: STAGE,
      message,
      trace: { mode: "UNKNOWN" as const, ...trace },
    });

    // 0) Narrow unknown -> object
    if (!isObject(env)) {
      return error({
        rulesApplied: [parseFailedRule],
      } as any);
    }

    const ids = isObject((env as any).ids) ? (env as any).ids : undefined;
    const stages = isObject((env as any).stages)
      ? (env as any).stages
      : undefined;
    const proposalId =
      typeof ids?.proposalId === "string" ? ids.proposalId : "";

    if (!proposalId || !stages) {
      return error({
        proposalId: proposalId || undefined,
        rulesApplied: [parseFailedRule],
      } as any);
    }

    const validation = stages.validation;
    const planning = stages.planning;

    if (!isObject(validation) || !isObject(planning)) {
      return error({
        proposalId,
        rulesApplied: [parseFailedRule],
      } as any);
    }

    const commitPolicy =
      validation.hasRun === true ? (validation as any).commitPolicy : undefined;

    // 1) Candidate for schema validation
    const candidate = {
      proposalId,
      snapshotId: ids?.snapshotId,
      validationDecision:
        validation.hasRun === true
          ? (validation as any).validationId
          : "validation_unknown",
      planId: ids?.planningId ?? "planning_unknown",
      plan: (planning as any)?.plan ?? [],
      commitPolicy,
    };

    const parsed = InputSchema.safeParse(candidate);

    if (!parsed.success) {
      return error({
        proposalId,
        snapshotId: ids?.snapshotId,
        planId: ids?.planningId,
        rulesApplied: [parseFailedRule],
      } as any);
    }

    return { ok: true as const, data: parsed.data };
  };
};

type PreGuardOk = { ok: true; env: IngestionPipelineEnvelope };
type PreGuardFail = { ok: false; env: IngestionPipelineEnvelope };

export const preGuardFactory =
  <TStage extends EnvelopeStage, TCode extends string>({
    STAGE,
    CODE,
  }: {
    STAGE: TStage;
    CODE: TCode;
  }) =>
  (env: IngestionPipelineEnvelope): PreGuardOk | PreGuardFail => {
    const planning = env.stages.planning;

    if (!planning?.hasRun) {
      return {
        ok: false,
        env: appendError(env, {
          stage: STAGE,
          severity: "HALT",
          code: CODE,
          message: "Planning stage has not run.",
          trace: { proposalId: env.ids.proposalId, planningHasRun: false },
          at: Date.now(),
        }),
      };
    }

    // prereq: snapshotId exists (if you want execution to be pinned to a snapshot)
    if (!env.ids.snapshotId) {
      return {
        ok: false,
        env: appendError(env, {
          stage: STAGE,
          severity: "HALT",
          code: CODE,
          message: "Missing snapshotId required for execution.",
          trace: {
            proposalId: env.ids.proposalId,
            snapshotId: env.ids.snapshotId,
          },
          at: Date.now(),
        }),
      };
    }

    return { ok: true, env };
  };
