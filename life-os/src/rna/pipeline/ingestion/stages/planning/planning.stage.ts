import { pipe } from "fp-ts/function";
import * as E from "fp-ts/Either";

import { fingerprint } from "#/domain/encoding/fingerprint";
import { getNewId } from "#/domain/identity/id.provider";
import {
  leftFromLastError,
  makeStageLeft,
} from "#/platform/pipeline/stage/stage";

import { appendError, hasHaltingErrors } from "#/rna/envelope/envelope-utils";
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";

import { guardPrePlanning, guardPlanning } from "./planning.guard";
import type { PlanningErrorCode, PlanningStage } from "./planning.types";
import { STAGE } from "./planning.const";

const left = makeStageLeft<IngestionPipelineEnvelope>(appendError);

export const planningStage: PlanningStage = (env) => {
  // 0) fail closed if earlier stage produced HALT errors
  if (hasHaltingErrors(env)) return E.right(env);

  return pipe(
    E.right(env),

    // 1) prereqs (stage-level, before guard)
    E.chain((env) => {
      const pre = guardPrePlanning(env as any);

      return pre.ok
        ? E.right(pre.env)
        : leftFromLastError<
            IngestionPipelineEnvelope,
            typeof STAGE,
            PlanningErrorCode
          >(pre.env);
    }),

    // 2) run guard (guard plucks directly from env)
    E.chain((env) => {
      const g = guardPlanning(env);

      if (g.ok) return E.right({ env, data: g.data });

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
        code: g.code as PlanningErrorCode,
        message: g.message,
        trace: g.trace,
      });
    }),

    // 3) write stage output back into envelope
    E.map(({ env, data }) => {
      const ranAt = Date.now();
      const planningId = getNewId("planning");
      const planning = {
        hasRun: true,
        ranAt,
        observed: {
          validationId: env.ids.validationId,
          proposalId: env.ids.proposalId,
          snapshotId: env.ids.snapshotId,
        },
        planningId,
        plan: data.plan,
        fingerprint: fingerprint({
          proposalId: env.ids.proposalId,
          snapshotId: env.ids.snapshotId,
          plan: data.plan,
          commitPolicy: data.commitPolicy,
        }),
      } satisfies IngestionPipelineEnvelope["stages"]["planning"];

      return {
        ...env,
        ids: { ...env.ids, planningId },
        stages: { ...env.stages, planning },
      };
    }),
  );
};
