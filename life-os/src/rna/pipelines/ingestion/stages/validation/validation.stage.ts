import { fingerprint } from "#/domain/encoding/fingerprint";
import { getNewId } from "#/domain/identity/id.provider";
import { appendError, hasHaltingErrors } from "#/rna/envelope/envelope-utils";

import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";
import { guardPreValidation, guardValidation } from "./validation.guard";

export const STAGE = "VALIDATION" as const;

export function validationStage(
  env: IngestionPipelineEnvelope
): IngestionPipelineEnvelope {
  // 0) fail closed if earlier stage produced HALT errors
  if (hasHaltingErrors(env)) return env;

  // 1) prereqs (stage-level, before guard)
  const preReqRes = guardPreValidation(env);

  if (!preReqRes.ok) return preReqRes.env;

  // 2) run guard (guard plucks directly from env)
  const result = guardValidation(env);

  if (!result.ok) {
    return appendError(env, {
      stage: STAGE,
      severity: "HALT",
      code: result.code,
      message: result.message,
      trace: result.trace,
      at: Date.now(),
    });
  }

  if (!env.snapshot.permissions.allow.length) {
    return appendError(env, {
      stage: STAGE,
      severity: "HALT",
      code: "SNAPSHOT_PERMISSION_NOT_ALLOWED",
      message: "Permissions have none allowed",
      trace: {
        snapshot: env.snapshot,
      },
      at: Date.now(),
    });
  }

  // 3) write stage output back into envelope
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
        decisionType: "APPROVE", // "APPROVE", "REJECT", "PARTIAL_APPROVE", "ESCALATE"
        decidedAt: ranAt,
        justification: true,
        attribution: [],
      } as any,
    },
  };
}
