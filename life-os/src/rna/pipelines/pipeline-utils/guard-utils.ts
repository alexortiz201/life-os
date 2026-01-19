import type { keyof, z } from "zod";

// import { errorResultFactory } from "#/rna/pipelines/pipeline-utils";
import { appendError } from "#/rna/envelope/envelope-utils";
import type {
  EnvelopeIds,
  IngestionPipelineEnvelope,
} from "#/types/rna/pipeline/ingestion/ingestion.types";

import type { EnvelopeStage } from "#/types/rna/envelope/envelope.types";
import { ENVELOPE_STAGE_TO_KEY } from "#/types/rna/envelope/envelope.const";
import { PipelineStage } from "#/types/rna/pipeline/pipeline.types";

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

export type CandidateInput = {
  env: IngestionPipelineEnvelope;
  ids: any;
  stages: any;
  proposalId: string;
};

const hasAllDepStages = (STAGE: EnvelopeStage, stages: any) => {
  if (STAGE === "ENVELOPE") return { ok: false };

  for (let stage of PREV_STAGES_DEPS[STAGE].stages) {
    if (!isObject(stages[ENVELOPE_STAGE_TO_KEY[stage]])) return { ok: false };
  }

  return { ok: true };
};

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
  getCandidate = ({}) => ({}),
}: {
  STAGE: TStage;
  InputSchema: TSchema;
  code: TCode;
  parseFailedRule: TParseRule;
  message?: string;
  getCandidate: ({}: CandidateInput) => {};
}) => {
  type Data = z.infer<TSchema>;

  return (
    env: IngestionPipelineEnvelope
  ): GuardResult<TStage, TCode, TParseRule, TTrace, Data> => {
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

    if (!ids || !proposalId || !stages) {
      return error({
        // ids,
        proposalId,
        rulesApplied: [parseFailedRule],
      } as any);
    }

    const res = hasAllDepStages(STAGE, stages);

    if (!res.ok) {
      return error({
        proposalId,
        message: `${STAGE}: Missing prereq stage, invalid input.`,
        rulesApplied: [parseFailedRule],
      } as any);
    }

    // 1) Candidate for schema validation
    const candidate = getCandidate({
      env,
      ids,
      stages,
      proposalId,
    });

    const parsed = InputSchema.safeParse(candidate);

    if (!parsed.success) {
      return error({
        proposalId,
        snapshotId: ids?.snapshotId,
        planningId: ids?.planningId,
        message: `${STAGE}: Schema parsing failed, invalid input.`,
        rulesApplied: [parseFailedRule],
      } as any);
    }

    return { ok: true as const, data: parsed.data };
  };
};

type PreGuardOk = { ok: true; env: IngestionPipelineEnvelope };
type PreGuardFail = { ok: false; env: IngestionPipelineEnvelope };
type PreGuardResult = PreGuardOk | PreGuardFail;

const assertStageHasRun = ({
  env,
  stageToValidate,
  STAGE,
  CODE,
}: {
  env: IngestionPipelineEnvelope;
  stageToValidate: PipelineStage;
  STAGE: PipelineStage;
  CODE: string;
}): PreGuardResult => {
  const stageKey = ENVELOPE_STAGE_TO_KEY[stageToValidate];
  const stage = env.stages[stageKey];

  if (!stage?.hasRun) {
    return {
      ok: false,
      env: appendError(env, {
        stage: STAGE,
        severity: "HALT",
        code: CODE,
        message: `${stageKey} stage has not run.`,
        trace: {
          proposalId: env.ids.proposalId,
          // this is fine, but the key becomes string at type level
          // if you want this typed, see note below
          [`${stageKey}HasRun`]: false,
        },
        at: Date.now(),
      }),
    };
  }

  return { ok: true, env };
};

export const assertIdExists = ({
  env,
  STAGE,
  CODE,
  idKey,
  message,
}: {
  env: IngestionPipelineEnvelope;
  STAGE: PipelineStage;
  CODE: string;
  idKey: keyof EnvelopeIds;
  message?: string;
}): PreGuardResult => {
  const value = env.ids[idKey];
  const exists = typeof value === "string" && value.length > 0;

  if (!exists) {
    return {
      ok: false,
      env: appendError(env, {
        stage: STAGE,
        severity: "HALT",
        code: CODE,
        message: message ?? `Missing required id: ${String(idKey)}.`,
        trace: {
          proposalId: env.ids.proposalId,
          idKey,
          value: value ?? undefined,
        },
        at: Date.now(),
      }),
    };
  }

  return { ok: true, env };
};

export const PREV_STAGES_DEPS = {
  INTAKE: { stages: [], ids: [] },
  VALIDATION: { stages: ["INTAKE"], ids: ["proposalId", "snapshotId"] },
  PLANNING: {
    stages: ["VALIDATION"],
    ids: ["proposalId", "validationId", "snapshotId"],
  },
  EXECUTION: {
    stages: ["PLANNING"],
    ids: ["proposalId", "planningId", "snapshotId"],
  },
  REVALIDATION: {
    stages: ["EXECUTION", "VALIDATION"],
    ids: ["proposalId", "effectsLogId", "snapshotId"],
  },
  COMMIT: { stages: ["REVALIDATION"], ids: ["proposalId"] },
} as const satisfies Record<
  PipelineStage,
  { stages: readonly PipelineStage[]; ids: readonly (keyof EnvelopeIds)[] }
>;

const assertStageDependencies = ({
  env,
  STAGE,
  CODE,
}: {
  env: IngestionPipelineEnvelope;
  STAGE: PipelineStage;
  CODE: string;
}): PreGuardResult => {
  const stageDeps = PREV_STAGES_DEPS[STAGE];
  let nextEnv = env;

  for (let stage of stageDeps.stages) {
    const res = assertStageHasRun({
      env: nextEnv,
      stageToValidate: stage,
      STAGE,
      CODE,
    });

    if (!res.ok) return res;
    nextEnv = res.env;
  }

  const stageKey = ENVELOPE_STAGE_TO_KEY[STAGE];

  for (let idKey of stageDeps.ids) {
    const res = assertIdExists({
      env: nextEnv,
      STAGE,
      CODE,
      idKey,
      message: `Missing ${String(idKey)} required for ${stageKey}.`,
    });

    if (!res.ok) return res;
    nextEnv = res.env;
  }

  return { ok: true, env: nextEnv };
};

export const preGuardFactory =
  <TStage extends PipelineStage, TCode extends string>({
    STAGE,
    CODE,
  }: {
    STAGE: TStage;
    CODE: TCode;
  }) =>
  (env: IngestionPipelineEnvelope): PreGuardResult => {
    const depsAssert = assertStageDependencies({
      env,
      STAGE,
      CODE,
    });
    // console.log({ depsAssert });
    if (!depsAssert.ok) return depsAssert;

    return { ok: true, env: depsAssert.env };
  };
