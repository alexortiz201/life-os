import { appendError, hasHaltingErrors } from "#/rna/pipelines/envelope-utils";

import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";

import { guardPrePlanning, guardPlanning } from "./planning.guard";

export const STAGE = "PLANNING" as const;

export function planningStage(
  env: IngestionPipelineEnvelope
): IngestionPipelineEnvelope {
  // 0) fail closed if earlier stage produced HALT errors
  if (hasHaltingErrors(env)) return env;

  // 1) prereqs (stage-level, before guard)
  const preReqRes = guardPrePlanning(env);

  if (!preReqRes.ok) return preReqRes.env;

  // 2) run guard (guard plucks directly from env)
  const result = guardPlanning(env);

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
  const planningId = `planning_${ranAt}`;

  return {
    ...env,
    ids: {
      ...env.ids,
      planningId,
    },
    stages: {
      ...env.stages,
      planning: {
        hasRun: true,
        ranAt,
        observed: {
          proposalId: env.ids.proposalId,
          snapshotId: env.ids.snapshotId,
        } as any,
        planningId,
      } as any,
    },
  };
}
