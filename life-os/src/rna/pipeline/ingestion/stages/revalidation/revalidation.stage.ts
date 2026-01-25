import { pipe } from "fp-ts/function";
import * as E from "fp-ts/Either";

import { appendError, hasHaltingErrors } from "#/rna/envelope/envelope-utils";
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";

import { guardPreRevalidation, guardRevalidation } from "./revalidation.guard";
import { makeStageLeft, StageLeft } from "#/platform/pipeline/stage/stage";

export const STAGE = "REVALIDATION" as const;

export type RevalidationErrorCode =
  | "REVALIDATION_PREREQ_MISSING"
  | "INVALID_REVALIDATION_INPUT";

const left = makeStageLeft<IngestionPipelineEnvelope>(appendError);

export type RevalidationStage = (
  env: IngestionPipelineEnvelope
) => E.Either<
  StageLeft<IngestionPipelineEnvelope, typeof STAGE, RevalidationErrorCode>,
  IngestionPipelineEnvelope
>;

export const revalidationStage: RevalidationStage = (env) => {
  // 0) fail closed if earlier stage produced HALT errors
  if (hasHaltingErrors(env)) return E.right(env);

  return pipe(
    E.right(env),

    // 1) prereqs
    E.chain((env) => {
      const pre = guardPreRevalidation(env);
      return pre.ok
        ? E.right(pre.env)
        : left({
            env: pre.env,
            stage: STAGE,
            code: "REVALIDATION_PREREQ_MISSING",
            message: "Revalidation prereqs missing.",
            trace: { why: "preGuardFactory" },
          });
    }),

    // 2) guard (schema/contract)
    E.chain((env) => {
      const g = guardRevalidation(env);

      if (g.ok) return E.right({ env, data: g.data });

      return left({
        env,
        stage: STAGE,
        code: g.code as RevalidationErrorCode,
        message: g.message,
        trace: g.trace,
      });
    }),

    // 3) write stage output
    E.map(({ env, data }) => {
      const ranAt = Date.now();
      const revalidationId = `revalidation_${ranAt}`;

      const observed = {
        snapshotId: env.ids.snapshotId,
        proposalId: env.ids.proposalId,
        intakeId: env.ids.intakeId,
        validationId: env.ids.validationId,
        planningId: env.ids.planningId,
        effectsLogId: env.ids.effectsLogId,
      };

      return {
        ...env,
        ids: {
          ...env.ids,
          revalidationId,
        },
        stages: {
          ...env.stages,
          revalidation: {
            hasRun: true,
            ranAt,
            observed,
            revalidationId,
            ...data,
          },
        },
      } as IngestionPipelineEnvelope;
    })
  );
};
