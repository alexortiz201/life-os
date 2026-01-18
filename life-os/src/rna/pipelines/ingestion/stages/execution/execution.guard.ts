import { isProvisionalArtifactEffect } from "#/domain/effects/effects.guards";
import { errorResultFactory } from "#/rna/pipelines/pipeline-utils";
import { appendError } from "#/rna/envelope/envelope-utils";
import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";

import type { ExecutionRule } from "#/types/rna/pipeline/ingestion/execution/execution.rules";
import type {
  GuardExecutionResult,
  ExecutionTrace,
} from "#/types/rna/pipeline/ingestion/execution/execution.types";
import { ExecutionInputSchema } from "#/types/rna/pipeline/ingestion/execution/execution.schemas";
import { STAGE } from "./execution.stage";

const errorResult = errorResultFactory<ExecutionTrace>();

function policyAllowsPartial(
  allowedModes: readonly ["FULL"] | readonly ["FULL", "PARTIAL"]
): boolean {
  // tuple-union safe check
  return allowedModes.length === 2;
}

/**
 * Minimal runtime narrowing so we can safely pluck from `unknown`.
 * (We still Zod-validate the "candidate" as the real contract.)
 */
function isObject(x: unknown): x is Record<string, any> {
  return typeof x === "object" && x !== null;
}

export function guardExecution(env: unknown): GuardExecutionResult {
  // ---------
  // 0) Narrow unknown -> something we can safely optional-chain
  // ---------
  if (!isObject(env)) {
    return errorResult({
      code: "INVALID_EXECUTION_INPUT",
      message: "Input invalid",
      trace: {
        mode: "UNKNOWN",
        rulesApplied: ["PARSE_FAILED"] satisfies ExecutionRule[],
      },
    });
  }

  const ids = isObject(env.ids) ? env.ids : undefined;
  const stages = isObject(env.stages) ? env.stages : undefined;
  const proposalId = typeof ids?.proposalId === "string" ? ids.proposalId : "";

  if (!proposalId || !stages) {
    return errorResult({
      code: "INVALID_EXECUTION_INPUT",
      message: "Input invalid",
      trace: {
        mode: "UNKNOWN",
        proposalId: proposalId || undefined,
        rulesApplied: ["PARSE_FAILED"] satisfies ExecutionRule[],
      },
    });
  }

  const validation = stages.validation;
  const planning = stages.planning;

  // must exist as objects to proceed
  if (!isObject(validation) || !isObject(planning)) {
    return errorResult({
      code: "INVALID_EXECUTION_INPUT",
      message: "Input invalid",
      trace: {
        mode: "UNKNOWN",
        proposalId,
        rulesApplied: ["PARSE_FAILED"] satisfies ExecutionRule[],
      },
    });
  }

  // ---------
  // 1) Pluck what we can (fail-closed happens via Zod below)
  // ---------
  const commitPolicy =
    validation.hasRun === true ? (validation as any).commitPolicy : undefined;

  // const effectsLog = planning.hasRun === true ? (planning as any).effectsLog : undefined;

  const candidate = {
    proposalId,
    snapshotId: ids?.snapshotId,
    validationDecision:
      validation.hasRun === true
        ? (validation as any).validationId
        : "validation_unknown",
    planningId: ids?.planningId ?? "planning_unknown",
    plan: planning?.plan ?? [],
    commitPolicy,
  };

  const parsed = ExecutionInputSchema.safeParse(candidate);

  if (!parsed.success) {
    return errorResult({
      code: "INVALID_REVALIDATION_INPUT",
      message: "Input invalid",
      trace: {
        mode: "UNKNOWN",
        proposalId,
        snapshotId: ids?.snapshotId,
        planningId: ids?.planningId,
        allowListCount: 0,
        rulesApplied: ["PARSE_FAILED"] satisfies ExecutionRule[],
      },
    });
  }

  const { plan, commitPolicy: parsedCommitPolicy } = parsed.data;

  // ---------
  // 2) Drift check (now meaningful)
  // ---------
  if (parsed.data.proposalId !== proposalId) {
    return {
      ok: true,
      data: {
        proposalId,
        plan: plan,
        execution: {
          proposalId,
          outcome: "REJECT_EXECUTION",
          commitAllowList: [],
          rulesApplied: ["DRIFT_DETECTED"] satisfies ExecutionRule[],
        },
      },
    };
  }

  // ---------
  // 3) PARTIAL requirement: any non-ARTIFACT produced effect
  // ---------
  // const hasNonArtifact = parsedEffectsLog.producedEffects.some(
  //   (e) => e.effectType !== "ARTIFACT"
  // );

  // if (hasNonArtifact) {
  //   if (!policyAllowsPartial(parsedCommitPolicy.allowedModes)) {
  //     return errorResult({
  //       code: "PARTIAL_NOT_ALLOWED",
  //       message:
  //         "Commit policy forbids PARTIAL but non-artifact effects are present.",
  //       trace: {
  //         mode: "PARTIAL",
  //         proposalId,
  //         effectsLogDeclaredProposalId: parsedEffectsLog.proposalId,
  //         effectsLogId: parsedEffectsLog.effectsLogId,
  //         rulesApplied: [
  //           "NON_ARTIFACT_EFFECTS_PRESENT",
  //           "PARTIAL_NOT_ALLOWED_BY_POLICY",
  //         ] satisfies ExecutionRule[],
  //       },
  //     });
  //   }

  //   const allow = parsedEffectsLog.producedEffects
  //     .filter(isProvisionalArtifactEffect)
  //     .map((e) => e.objectId);

  //   return {
  //     ok: true,
  //     data: {
  //       proposalId,
  //       effectsLog: parsedEffectsLog,
  //       revalidation: {
  //         proposalId,
  //         outcome: "PARTIAL_COMMIT",
  //         commitAllowList: allow,
  //         rulesApplied: [
  //           "NON_ARTIFACT_EFFECTS_PRESENT",
  //         ] satisfies ExecutionRule[],
  //       },
  //     },
  //   };
  // }

  // ---------
  // 4) Full approval otherwise
  // ---------
  return {
    ok: true,
    data: {
      proposalId,
      plan: planning.plan,
      execution: {
        proposalId,
        outcome: "APPROVE_EXECUTION",
        commitAllowList: [],
        rulesApplied: [] satisfies ExecutionRule[],
      },
    },
  };
}

export function guardPreExecution(env: IngestionPipelineEnvelope) {
  const planning = env.stages.planning;

  if (!planning.hasRun) {
    return {
      ok: false,
      env: appendError(env, {
        stage: STAGE,
        severity: "HALT",
        code: "EXECUTION_PREREQ_MISSING",
        message: "Planning stage has not run.",
        trace: { proposalId: env.ids.proposalId, planningHasRun: false },
        at: Date.now(),
      }),
    };
  }

  // prereq: snapshotId exists (if you want execution to be pinned to a snapshot)
  if (!env.ids.snapshotId) {
    return {
      ok: false,
      env: appendError(env, {
        stage: STAGE,
        severity: "HALT",
        code: "EXECUTION_PREREQ_MISSING",
        message: "Missing snapshotId required for execution.",
        trace: {
          proposalId: env.ids.proposalId,
          snapshotId: env.ids.snapshotId,
        },
        at: Date.now(),
      }),
    };
  }

  return {
    ok: true,
    env,
  };
}
