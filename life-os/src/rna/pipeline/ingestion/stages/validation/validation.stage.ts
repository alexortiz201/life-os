import { pipe } from "fp-ts/function";
import * as E from "fp-ts/Either";

import { fingerprint } from "#/domain/encoding/fingerprint";
import { getNewId } from "#/domain/identity/id.provider";
import { Snapshot } from "#/domain/snapshot/snapshot.provider.types";
import {
  leftFromLastError,
  makeStageLeft,
} from "#/platform/pipeline/stage/stage";
import { appendError, hasHaltingErrors } from "#/rna/envelope/envelope-utils";
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";

import { guardPreValidation, guardValidation } from "./validation.guard";
import { ValidationErrorCode, ValidationStage } from "./validation.types";
import { STAGE } from "./validation.const";

const left = makeStageLeft<IngestionPipelineEnvelope>(appendError);

export const validationStage: ValidationStage = (env) => {
  // 0) fail closed if earlier stage produced HALT errors
  if (hasHaltingErrors(env)) return E.right(env);

  return pipe(
    E.right(env),

    E.chain((env) => {
      const pre = guardPreValidation(env as any);

      return pre.ok
        ? E.right(pre.env)
        : leftFromLastError<
            IngestionPipelineEnvelope,
            typeof STAGE,
            ValidationErrorCode
          >(pre.env);
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
      const snapshotId = getNewId("snapshot");
      const snapshot = {
        snapshotId,
        permissions: {
          actor: "USER" as const,
          allow: ["WEEKLY_REFLECTION"] as const,
        },

        scope: {
          allowedKinds: ["NOTE"] as const,
        },
        invariantsVersion: "test",
        timestampMs: ranAt,
        dependencyVersions: {},
      } satisfies Snapshot;

      const validation = {
        hasRun: true,
        ranAt,
        observed: {
          intakeId: env.ids.intakeId,
          proposalId: env.ids.proposalId,
        },
        validationId,
        commitPolicy: { allowedModes: ["FULL"] as const },
        decisionType: "APPROVE" as const,
        decidedAt: ranAt,
        justification: true,
        attribution: [] as const,

        fingerprint: fingerprint({
          proposalId: env.ids.proposalId,
          snapshotId,
          commitPolicy: "FULL",
        }),
        snapshot,
      } satisfies IngestionPipelineEnvelope["stages"]["validation"];

      return {
        ...env,
        ids: { ...env.ids, validationId, snapshotId },
        stages: { ...env.stages, validation },
      };
    }),
  );
};
