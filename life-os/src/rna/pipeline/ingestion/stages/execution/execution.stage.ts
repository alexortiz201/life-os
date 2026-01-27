// execution.stage.ts
import { pipe } from "fp-ts/function";
import * as E from "fp-ts/Either";

import { appendError, hasHaltingErrors } from "#/rna/envelope/envelope-utils";
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";
import {
  leftFromLastError,
  makeStageLeft,
  PipelineStageFn,
} from "#/platform/pipeline/stage/stage";
import { getNewId } from "#/domain/identity/id.provider";
import { guardPreExecution, guardExecution } from "./execution.guard";

export const STAGE = "EXECUTION" as const;

export type ExecutionErrorCode =
  | "EXECUTION_PREREQ_MISSING"
  | "INVALID_EXECUTION_INPUT";

const left = makeStageLeft<IngestionPipelineEnvelope>(appendError);

export type ExecutionStage = PipelineStageFn<
  IngestionPipelineEnvelope,
  typeof STAGE,
  ExecutionErrorCode
>;

export const executionStage: ExecutionStage = (env) => {
  // 0) fail closed if earlier stage produced HALT errors
  if (hasHaltingErrors(env)) return E.right(env);

  return pipe(
    E.right(env),

    // 1) prereqs (stage-level, before guard)
    E.chain((env) => {
      const pre = guardPreExecution(env as any);

      return pre.ok
        ? E.right(pre.env)
        : leftFromLastError<
            IngestionPipelineEnvelope,
            typeof STAGE,
            ExecutionErrorCode
          >(pre.env);
    }),

    // 2) run guard (schema / contract)
    E.chain((env) => {
      const g = guardExecution(env);

      if (g.ok) return E.right(env);

      const nextEnv = appendError(env, {
        stage: STAGE,
        severity: "HALT",
        code: g.code,
        message: g.message,
        trace: g.trace,
        at: Date.now(),
      });

      return left({
        env: nextEnv,
        stage: STAGE,
        code: g.code as ExecutionErrorCode,
        message: g.message,
        trace: g.trace,
      });
    }),

    // 3) write stage output back into envelope
    E.map((env) => {
      const ranAt = Date.now();
      const executionId = getNewId("execution");
      const effectsLogId = getNewId("effects");
      const execution = {
        hasRun: true,
        ranAt,
        observed: {
          proposalId: env.ids.proposalId,
          snapshotId: env.ids.snapshotId,
          planningId: env.ids.planningId,
        },
        executionId,
        effectsLog: {
          effectsLogId,
          proposalId: env.ids.proposalId,
          producedEffects: [],
        },
      } satisfies IngestionPipelineEnvelope["stages"]["execution"];

      return {
        ...env,
        ids: { ...env.ids, executionId, effectsLogId },
        stages: { ...env.stages, execution },
      };
    })
  );
};
