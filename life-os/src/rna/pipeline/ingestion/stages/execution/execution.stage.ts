// execution.stage.ts
import { pipe } from "fp-ts/function";
import * as E from "fp-ts/Either";

import { appendError, hasHaltingErrors } from "#/rna/envelope/envelope-utils";
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";

import { guardPreExecution, guardExecution } from "./execution.guard";
import { makeStageLeft, StageLeft } from "#/platform/pipeline/stage/stage";

export const STAGE = "EXECUTION" as const;

export type ExecutionErrorCode =
  | "EXECUTION_PREREQ_MISSING"
  | "INVALID_EXECUTION_INPUT";

const left = makeStageLeft<IngestionPipelineEnvelope>(appendError);

export type ExecutionStage = (
  env: IngestionPipelineEnvelope
) => E.Either<
  StageLeft<IngestionPipelineEnvelope, typeof STAGE, ExecutionErrorCode>,
  IngestionPipelineEnvelope
>;

export const executionStage: ExecutionStage = (env) => {
  // 0) fail closed if earlier stage produced HALT errors
  if (hasHaltingErrors(env)) return E.right(env);

  return pipe(
    E.right(env),

    // 1) prereqs (stage-level, before guard)
    E.chain((env) => {
      const pre = guardPreExecution(env);

      return pre.ok
        ? E.right(pre.env)
        : left({
            env: pre.env,
            stage: STAGE,
            code: "EXECUTION_PREREQ_MISSING",
            message: "Execution prereqs missing.",
            trace: { why: "preGuardFactory" },
          });
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
      // v0: produce effects (stub)
      const producedEffects = [] as any[]; // replace soon

      const ranAt = Date.now();
      const executionId = `execution_${ranAt}`;
      const effectsLogId = `effects_${ranAt}`;

      const effectsLog = {
        effectsLogId,
        proposalId: env.ids.proposalId,
        producedEffects,
      };

      return {
        ...env,
        ids: {
          ...env.ids,
          executionId,
          effectsLogId,
        },
        stages: {
          ...env.stages,
          execution: {
            hasRun: true,
            ranAt,
            observed: {
              proposalId: env.ids.proposalId,
              snapshotId: env.ids.snapshotId,
              planningId: env.ids.planningId,
            } as any,
            executionId,
            effectsLog,
            // executionResult: [] // later
          } as any,
        },
      } as IngestionPipelineEnvelope;
    })
  );
};
