import type { z } from "zod";

import { errorResultFactory } from "#/rna/pipelines/pipeline-utils";
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

const hasAllDepStages = (STAGE: EnvelopeStage, env: any | undefined) => {
  if (STAGE === "ENVELOPE") {
    return { ok: false, needsStages: false, needsIds: false };
  }

  const ok = false;
  const { stages: depStages, ids: depIds } = INGESTION_STAGE_DEPS[STAGE];
  const needsStages = depStages.length > 0;
  const needsIds = depIds.length > 0;

  if (needsIds && !isObject(env?.ids)) {
    return {
      ok,
      needsStages,
      needsIds,
      code: `MISSING_ALL_IDS`,
      message: `env.ids missing`,
    };
  }
  if (needsStages && !isObject(env?.stages)) {
    return {
      ok,
      needsStages,
      needsIds,
      code: `MISSING_ALL_STAGES`,
      message: `env.stages missing`,
    };
  }

  for (let id of depIds) {
    if (!env.ids[id]) {
      return {
        ok,
        needsStages,
        needsIds,
        code: `MISSING_ID`,
        message: `env.id missing: ${id}`,
      };
    }
  }

  for (let stage of depStages) {
    const stageKey = ENVELOPE_STAGE_TO_KEY[stage];

    if (!env.stages[stageKey]) {
      return {
        ok,
        needsStages,
        needsIds,
        code: `MISSING_STAGE`,
        message: `env.stage missing: ${stageKey}`,
      };
    }
  }

  return { ok: true, needsStages, needsIds };
};

type NarrowFail<TParseRule extends string> = {
  ok: false;
  reason:
    | "NOT_OBJECT"
    | "MISSING_IDS"
    | "MISSING_PROPOSAL_ID"
    | "MISSING_STAGES"
    | "MISSING_DEP_STAGE";
  traceBase: {
    proposalId?: string;
    rulesApplied: readonly TParseRule[];
    message?: string;
  } & Record<string, unknown>;
};

type NarrowOk = {
  ok: true;
  ids: any;
  stages: any;
  proposalId: string;
};

type NarrowResult<TParseRule extends string> =
  | NarrowOk
  | NarrowFail<TParseRule>;

function narrowGuardInputs<
  TEnv,
  TStage extends EnvelopeStage,
  TParseRule extends string
>({
  env,
  STAGE,
  parseFailedRule,
}: {
  env: TEnv;
  STAGE: TStage;
  parseFailedRule: TParseRule;
}): NarrowResult<TParseRule> {
  if (!isObject(env)) {
    return {
      ok: false,
      reason: "NOT_OBJECT",
      traceBase: { rulesApplied: [parseFailedRule] as const },
    };
  }

  const ids = isObject((env as any).ids) ? (env as any).ids : undefined;
  const stages = isObject((env as any).stages)
    ? (env as any).stages
    : undefined;

  const dep = hasAllDepStages(STAGE, env);
  const rulesApplied = [parseFailedRule] as const;

  if (dep.needsIds) {
    if (dep.code === "MISSING_ALL_IDS") {
      return {
        ok: false,
        reason: "MISSING_IDS",
        traceBase: { ids, rulesApplied },
      };
    }
    if (!ids.proposalId) {
      return {
        ok: false,
        reason: "MISSING_PROPOSAL_ID",
        traceBase: { proposalId: "", rulesApplied },
      };
    }
  }

  const proposalId = ids.proposalId;

  if (dep.needsStages) {
    if (dep.code === "MISSING_ALL_STAGES") {
      return {
        ok: false,
        reason: "MISSING_STAGES",
        traceBase: { proposalId, rulesApplied },
      };
    }
    if (dep.code === "MISSING_STAGE") {
      return {
        ok: false,
        reason: "MISSING_DEP_STAGE",
        traceBase: {
          proposalId,
          message: `${STAGE}: Missing prereq stage, invalid input.`,
          rulesApplied,
        },
      };
    }
  }

  return { ok: true, ids, stages, proposalId };
}

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
  pluckParams,
}: {
  STAGE: TStage;
  InputSchema: TSchema;
  code: TCode;
  parseFailedRule: TParseRule;
  message?: string;
  pluckParams: (args: SchemaParseParams<TEnv>) => z.input<TSchema>;
}) => {
  type Data = z.infer<TSchema>;

  const error = errorResultFactory<TStage, TCode>({
    stage: STAGE,
    code,
    message,
  });

  return (env: TEnv): GuardResult<TStage, TCode, TParseRule, TTrace, Data> => {
    const narrowed = narrowGuardInputs({ env, STAGE, parseFailedRule });

    if (!narrowed.ok) {
      // build a trace that satisfies GuardTrace<TTrace, TParseRule>
      return error({
        ...(narrowed.traceBase as any), // only cast lives here, once
      }) as any;
    }

    const { ids, stages, proposalId } = narrowed;

    const schemaInput = pluckParams({ env, ids, stages, proposalId });
    const parsed = InputSchema.safeParse(schemaInput);

    if (!parsed.success) {
      return error({
        ids,
        message: `${STAGE}: Schema parsing failed, invalid input.`,
        rulesApplied: [parseFailedRule] as const,
      } as any);
    }

    return { ok: true as const, data: parsed.data };
  };
};
