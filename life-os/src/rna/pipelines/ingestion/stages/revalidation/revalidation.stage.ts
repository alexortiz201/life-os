import { appendError, hasHaltingErrors } from "#/rna/pipelines/envelope-utils";

import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";

import { guardPreRevalidation, guardRevalidation } from "./revalidation.guard";

export const STAGE = "REVALIDATION";

export function revalidationStage(
  env: IngestionPipelineEnvelope
): IngestionPipelineEnvelope {
  // 0) fail closed if earlier stage produced HALT errors
  if (hasHaltingErrors(env)) return env;

  // 1) prereqs (stage-level, before guard)
  const preReqRes = guardPreRevalidation(env);

  if (!preReqRes.ok) return preReqRes.env;

  // 2) run guard (guard plucks directly from env)
  const result = guardRevalidation(env);

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

  // 3) write stage output back into envelope
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
        ...result.data,
      },
    },
  };
}
