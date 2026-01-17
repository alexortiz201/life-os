import { appendError, hasHaltingErrors } from "#/rna/envelope/envelope-utils";

import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";

import { guardPreExecution, guardExecution } from "./execution.guard";

export const STAGE = "EXECUTION" as const;

export function executionStage(
  env: IngestionPipelineEnvelope
): IngestionPipelineEnvelope {
  // 0) fail closed if earlier stage produced HALT errors
  if (hasHaltingErrors(env)) return env;

  // 1) prereqs (stage-level, before guard)
  const preReqRes = guardPreExecution(env);

  if (!preReqRes.ok) return preReqRes.env;

  // 2) run guard (guard plucks directly from env)
  const result = guardExecution(env);

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
  };
}
