import type { IngestionPipelineEnvelope } from "#types/rna/pipeline/ingestion/ingestion.types";
import { guardRevalidation } from "./revalidation.guard";
import { appendError, hasHaltingErrors } from "#/rna/pipelines/envelope-utils";

export function revalidationStage(
  env: IngestionPipelineEnvelope
): IngestionPipelineEnvelope {
  // 0) fail closed if earlier stage produced HALT errors
  if (hasHaltingErrors(env)) return env;

  // 1) prereqs (stage-level, before guard)
  const execution = env.stages.execution;
  if (!execution.hasRun) {
    return appendError(env, {
      stage: "REVALIDATION",
      severity: "HALT",
      code: "REVALIDATION_PREREQ_MISSING",
      message: "Execution stage has not run.",
      trace: { proposalId: env.ids.proposalId, executionHasRun: false },
      at: Date.now(),
    });
  }

  const validation = env.stages.validation;
  if (!validation.hasRun) {
    return appendError(env, {
      stage: "REVALIDATION",
      severity: "HALT",
      code: "REVALIDATION_PREREQ_MISSING",
      message: "Validation stage has not run (commitPolicy missing).",
      trace: { proposalId: env.ids.proposalId, validationHasRun: false },
      at: Date.now(),
    });
  }

  // commitPolicy should be produced by validation (source of truth)
  if (!(validation as any).commitPolicy) {
    return appendError(env, {
      stage: "REVALIDATION",
      severity: "HALT",
      code: "REVALIDATION_PREREQ_MISSING",
      message: "Missing commitPolicy on validation stage output.",
      trace: { proposalId: env.ids.proposalId },
      at: Date.now(),
    });
  }

  if (!env.ids.snapshotId) {
    return appendError(env, {
      stage: "REVALIDATION",
      severity: "HALT",
      code: "REVALIDATION_PREREQ_MISSING",
      message:
        "Missing snapshotId (meaning version) required for revalidation.",
      trace: { proposalId: env.ids.proposalId, snapshotId: env.ids.snapshotId },
      at: Date.now(),
    });
  }

  if (!env.ids.effectsLogId) {
    return appendError(env, {
      stage: "REVALIDATION",
      severity: "HALT",
      code: "REVALIDATION_PREREQ_MISSING",
      message: "Missing effectsLogId required for revalidation.",
      trace: {
        proposalId: env.ids.proposalId,
        effectsLogId: env.ids.effectsLogId,
      },
      at: Date.now(),
    });
  }

  // 2) run guard (guard plucks directly from env)
  const result = guardRevalidation(env);

  if (!result.ok) {
    return appendError(env, {
      stage: "REVALIDATION",
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
    proposalId: env.ids.proposalId,
    snapshotId: env.ids.snapshotId, // required by your ObservedIds for REVALIDATION
    effectsLogId: env.ids.effectsLogId, // required by your ObservedIds for REVALIDATION
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
        ...result.data, // must match RevalidationDirectiveReady
      },
    },
  };
}
