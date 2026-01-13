import { isProvisionalArtifactEffect } from "#/domain/effects/effects.guards";
import { errorResultFactory } from "#/rna/pipelines/pipeline-utils";
import { appendError } from "#/rna/pipelines/envelope-utils";

import type { RevalidationRule } from "#types/rna/pipeline/ingestion/revalidation/revalidation.rules";
import type { IngestionPipelineEnvelope } from "#types/rna/pipeline/ingestion/ingestion.types";
import type {
  GuardRevalidationResult,
  RevalidationTrace,
} from "#types/rna/pipeline/ingestion/revalidation/revalidation.types";
import { RevalidationInputSchema } from "#types/rna/pipeline/ingestion/revalidation/revalidation.schemas";
import { STAGE } from "./revalidation.stage";

const errorResult = errorResultFactory<RevalidationTrace>();

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

export function guardRevalidation(env: unknown): GuardRevalidationResult {
  // ---------
  // 0) Narrow unknown -> something we can safely optional-chain
  // ---------
  if (!isObject(env)) {
    return errorResult({
      code: "INVALID_REVALIDATION_INPUT",
      message: "Input invalid",
      trace: {
        mode: "UNKNOWN",
        rulesApplied: ["PARSE_FAILED"] satisfies RevalidationRule[],
      },
    });
  }

  const ids = isObject(env.ids) ? env.ids : undefined;
  const stages = isObject(env.stages) ? env.stages : undefined;
  const proposalId = typeof ids?.proposalId === "string" ? ids.proposalId : "";

  if (!proposalId || !stages) {
    return errorResult({
      code: "INVALID_REVALIDATION_INPUT",
      message: "Input invalid",
      trace: {
        mode: "UNKNOWN",
        proposalId: proposalId || undefined,
        rulesApplied: ["PARSE_FAILED"] satisfies RevalidationRule[],
      },
    });
  }

  const validation = stages.validation;
  const execution = stages.execution;

  // must exist as objects to proceed
  if (!isObject(validation) || !isObject(execution)) {
    return errorResult({
      code: "INVALID_REVALIDATION_INPUT",
      message: "Input invalid",
      trace: {
        mode: "UNKNOWN",
        proposalId,
        rulesApplied: ["PARSE_FAILED"] satisfies RevalidationRule[],
      },
    });
  }

  // ---------
  // 1) Pluck what we can (fail-closed happens via Zod below)
  // ---------
  const commitPolicy =
    validation.hasRun === true ? (validation as any).commitPolicy : undefined;

  // Prefer canonical effectsLog if you store it on execution stage
  const effectsLog =
    execution.hasRun === true ? (execution as any).effectsLog : undefined;

  const candidate = {
    proposalId,
    revisionId: ids?.snapshotId,
    validationDecision:
      validation.hasRun === true
        ? (validation as any).validationId
        : "validation_unknown",
    executionPlanId: ids?.planningId ?? "planning_unknown",
    executionPlan: [],
    executionResult: [],
    commitPolicy,
    effectsLog,
  };

  const parsed = RevalidationInputSchema.safeParse(candidate);

  if (!parsed.success) {
    return errorResult({
      code: "INVALID_REVALIDATION_INPUT",
      message: "Input invalid",
      trace: {
        mode: "UNKNOWN",
        proposalId,
        effectsLogDeclaredProposalId: (effectsLog as any)?.proposalId,
        effectsLogId: (effectsLog as any)?.effectsLogId ?? ids?.effectsLogId,
        allowListCount: 0,
        rulesApplied: ["PARSE_FAILED"] satisfies RevalidationRule[],
      },
    });
  }

  const { effectsLog: parsedEffectsLog, commitPolicy: parsedCommitPolicy } =
    parsed.data;

  // ---------
  // 2) Drift check (now meaningful)
  // ---------
  if (parsedEffectsLog.proposalId !== proposalId) {
    return {
      ok: true,
      data: {
        proposalId,
        effectsLog: parsedEffectsLog,
        revalidation: {
          proposalId,
          outcome: "REJECT_COMMIT",
          commitAllowList: [],
          rulesApplied: ["DRIFT_DETECTED"] satisfies RevalidationRule[],
        },
      },
    };
  }

  // ---------
  // 3) PARTIAL requirement: any non-ARTIFACT produced effect
  // ---------
  const hasNonArtifact = parsedEffectsLog.producedEffects.some(
    (e) => e.effectType !== "ARTIFACT"
  );

  if (hasNonArtifact) {
    if (!policyAllowsPartial(parsedCommitPolicy.allowedModes)) {
      return errorResult({
        code: "PARTIAL_NOT_ALLOWED",
        message:
          "Commit policy forbids PARTIAL but non-artifact effects are present.",
        trace: {
          mode: "PARTIAL",
          proposalId,
          effectsLogDeclaredProposalId: parsedEffectsLog.proposalId,
          effectsLogId: parsedEffectsLog.effectsLogId,
          rulesApplied: [
            "NON_ARTIFACT_EFFECTS_PRESENT",
            "PARTIAL_NOT_ALLOWED_BY_POLICY",
          ] satisfies RevalidationRule[],
        },
      });
    }

    const allow = parsedEffectsLog.producedEffects
      .filter(isProvisionalArtifactEffect)
      .map((e) => e.objectId);

    return {
      ok: true,
      data: {
        proposalId,
        effectsLog: parsedEffectsLog,
        revalidation: {
          proposalId,
          outcome: "PARTIAL_COMMIT",
          commitAllowList: allow,
          rulesApplied: [
            "NON_ARTIFACT_EFFECTS_PRESENT",
          ] satisfies RevalidationRule[],
        },
      },
    };
  }

  // ---------
  // 4) Full approval otherwise
  // ---------
  return {
    ok: true,
    data: {
      proposalId,
      effectsLog: parsedEffectsLog,
      revalidation: {
        proposalId,
        outcome: "APPROVE_COMMIT",
        commitAllowList: [],
        rulesApplied: [] satisfies RevalidationRule[],
      },
    },
  };
}

export function guardPreRevalidation(env: IngestionPipelineEnvelope) {
  const execution = env.stages.execution;
  if (!execution.hasRun) {
    return {
      ok: false,
      env: appendError(env, {
        stage: STAGE,
        severity: "HALT",
        code: "REVALIDATION_PREREQ_MISSING",
        message: "Execution stage has not run.",
        trace: { proposalId: env.ids.proposalId, executionHasRun: false },
        at: Date.now(),
      }),
    };
  }

  const validation = env.stages.validation;
  if (!validation.hasRun) {
    return {
      ok: false,
      env: appendError(env, {
        stage: STAGE,
        severity: "HALT",
        code: "REVALIDATION_PREREQ_MISSING",
        message: "Validation stage has not run (commitPolicy missing).",
        trace: { proposalId: env.ids.proposalId, validationHasRun: false },
        at: Date.now(),
      }),
    };
  }

  // commitPolicy should be produced by validation (source of truth)
  if (!(validation as any).commitPolicy) {
    return {
      ok: false,
      env: appendError(env, {
        stage: STAGE,
        severity: "HALT",
        code: "REVALIDATION_PREREQ_MISSING",
        message: "Missing commitPolicy on validation stage output.",
        trace: { proposalId: env.ids.proposalId },
        at: Date.now(),
      }),
    };
  }

  if (!env.ids.snapshotId) {
    return {
      ok: false,
      env: appendError(env, {
        stage: STAGE,
        severity: "HALT",
        code: "REVALIDATION_PREREQ_MISSING",
        message:
          "Missing snapshotId (meaning version) required for revalidation.",
        trace: {
          proposalId: env.ids.proposalId,
          snapshotId: env.ids.snapshotId,
        },
        at: Date.now(),
      }),
    };
  }

  if (!env.ids.effectsLogId) {
    return {
      ok: false,
      env: appendError(env, {
        stage: STAGE,
        severity: "HALT",
        code: "REVALIDATION_PREREQ_MISSING",
        message: "Missing effectsLogId required for revalidation.",
        trace: {
          proposalId: env.ids.proposalId,
          effectsLogId: env.ids.effectsLogId,
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
