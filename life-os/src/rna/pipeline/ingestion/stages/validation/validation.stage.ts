// validation.stage.ts
import { pipe } from "fp-ts/function";
import * as E from "fp-ts/Either";

import { fingerprint } from "#/domain/encoding/fingerprint";
import { getNewId } from "#/domain/identity/id.provider";
import { appendError, hasHaltingErrors } from "#/rna/envelope/envelope-utils";

import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";
import { guardPreValidation, guardValidation } from "./validation.guard";

import {
  makeStageLeft,
  PipelineStageFn,
  StageLeft,
} from "#/platform/pipeline/stage/stage";

export const STAGE = "VALIDATION" as const;

export type ValidationErrorCode =
  | "INVALID_VALIDATION_INPUT"
  | "VALIDATION_PREREQ_MISSING"
  | "SNAPSHOT_PERMISSION_NOT_ALLOWED";

const left = makeStageLeft<IngestionPipelineEnvelope>(appendError);

export type ValidationStage = PipelineStageFn<
  IngestionPipelineEnvelope,
  typeof STAGE,
  ValidationErrorCode
>;

export const validationStage: ValidationStage = (env) => {
  // 0) fail closed if earlier stage produced HALT errors
  if (hasHaltingErrors(env)) return E.right(env);

  return pipe(
    E.right(env),

    // 1) prereqs (stage-level, before guard)
    E.chain((env) => {
      const pre = guardPreValidation(env);

      return pre.ok
        ? E.right(pre.env)
        : left({
            env: pre.env,
            stage: STAGE,
            code: "VALIDATION_PREREQ_MISSING",
            message: "Validation prereqs missing.",
            trace: { why: "preGuardFactory" },
          });
    }),

    // 2) run guard (contract / schema)
    E.chain((env) => {
      const g = guardValidation(env);

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
        code: g.code as ValidationErrorCode,
        message: g.message,
        trace: g.trace,
      });
    }),

    // 2.5) extra rule: permissions must allow at least one action
    E.chain(({ env, data }) => {
      if (env.snapshot?.permissions?.allow?.length) {
        return E.right({ env, data });
      }

      const nextEnv = appendError(env, {
        stage: STAGE,
        severity: "HALT",
        code: "SNAPSHOT_PERMISSION_NOT_ALLOWED",
        message: "Permissions have none allowed",
        trace: { snapshot: env.snapshot },
        at: Date.now(),
      });

      return left({
        env: nextEnv,
        stage: STAGE,
        code: "SNAPSHOT_PERMISSION_NOT_ALLOWED",
        message: "Permissions have none allowed",
        trace: { snapshot: env.snapshot },
      });
    }),

    // 3) write stage output back into envelope
    E.map(({ env }) => {
      const ranAt = Date.now();
      const validationId = getNewId("validation");

      return {
        ...env,
        ids: {
          ...env.ids,
          validationId,
        },
        stages: {
          ...env.stages,
          validation: {
            hasRun: true,
            ranAt,
            observed: {
              proposalId: env.ids.proposalId,
              snapshotId: env.ids.snapshotId,
            } as any,
            validationId,
            proposalId: env.ids.proposalId,
            fingerprint: fingerprint({
              proposalId: env.ids.proposalId,
              snapshotId: env.ids.snapshotId,
              commitPolicy: "FULL",
            }),
            decisionType: "APPROVE",
            decidedAt: ranAt,
            justification: true,
            attribution: [],
          } as any,
        },
      } as IngestionPipelineEnvelope;
    })
  );
};
