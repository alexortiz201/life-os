import { appendError } from "#/rna/envelope/envelope-utils";
import { ENVELOPE_STAGE_TO_KEY } from "#/types/rna/envelope/envelope.const";
import { INGESTION_STAGE_DEPS } from "#/types/rna/pipeline/ingestion/ingestion.const";
import {
  EnvelopeIds,
  IngestionPipelineEnvelope,
} from "#/types/rna/pipeline/ingestion/ingestion.types";
import { PreGuardResult } from "#/types/rna/pipeline/pipeline-utils/preguard-utils.types";
import { PipelineStage } from "#/types/rna/pipeline/pipeline.types";

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

const assertStageDependencies = ({
  env,
  STAGE,
  CODE,
}: {
  env: IngestionPipelineEnvelope;
  STAGE: PipelineStage;
  CODE: string;
}): PreGuardResult => {
  const stageDeps = INGESTION_STAGE_DEPS[STAGE];
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

    if (!depsAssert.ok) return depsAssert;

    return { ok: true, env: depsAssert.env };
  };
