import { isProvisionalArtifactEffect } from "#/domain/effects/effects.guards";
import { errorResultFactory } from "#/platform/pipeline/error/error.factory";
import { guardFactory } from "#/platform/pipeline/guard/guard.factory";
import { preGuardFactory } from "#/platform/pipeline/preguard/preguard.factory";
import type { SchemaParseParams } from "#/platform/pipeline/guard/guard.factory.types";

import type {
  PostGuardRevalidationInput,
  RevalidationErrorCode,
  RevalidationInput,
  RevalidationRule,
} from "#/rna/pipeline/ingestion/stages/revalidation/revalidation.types";

import type { GuardRevalidationResult } from "./revalidation.types";
import { RevalidationInputSchema } from "./revalidation.schemas";
import { STAGE } from "./revalidation.const";

function policyAllowsPartial(
  allowedModes: readonly ["FULL"] | readonly ["FULL", "PARTIAL"],
): boolean {
  // tuple-union safe check
  return allowedModes.length === 2;
}

export const guardPreRevalidation = preGuardFactory({
  STAGE,
  CODE: "REVALIDATION_PREREQ_MISSING",
} as const);

const pluckParams = ({ ids, stages }: SchemaParseParams) => {
  const execution = stages.execution;
  const validation = stages.validation;
  const planning = stages.planning;

  return {
    proposalId: ids?.proposalId,
    snapshotId: ids?.snapshotId,
    executionId: ids?.executionId,
    planningId: ids?.planningId,
    validationDecision: (validation as any).validationId,
    plan: (planning as any)?.plan,
    commitPolicy: (validation as any).commitPolicy,
    effectsLog: (execution as any)?.effectsLog,
    // executionResult: execution.result
  } satisfies RevalidationInput;
};

export const guardRevalidation = guardFactory({
  STAGE,
  InputSchema: RevalidationInputSchema,
  code: "INVALID_REVALIDATION_INPUT",
  parseFailedRule: "PARSE_FAILED",
  pluckParams,
});

// example: drift rules, allowlist rules, etc
export function postGuardRevalidation(
  input: PostGuardRevalidationInput,
): GuardRevalidationResult {
  const {
    commitPolicy: parsedCommitPolicy,
    effectsLog: parsedEffectsLog,
    proposalId,
  } = input.data;

  const error = errorResultFactory<typeof STAGE, RevalidationErrorCode>({
    stage: STAGE,
    code: "INVALID_REVALIDATION_INPUT",
    message: "Post guard revalidation failed",
  });

  if (parsedEffectsLog.proposalId !== proposalId) {
    return {
      ok: true as const,
      data: {
        proposalId,
        effectsLog: parsedEffectsLog,
        directive: {
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
    (e) => e.effectType !== "ARTIFACT",
  );

  if (hasNonArtifact) {
    if (!policyAllowsPartial(parsedCommitPolicy.allowedModes)) {
      return error({
        proposalId,
        effectsLogDeclaredProposalId: parsedEffectsLog.proposalId,
        effectsLogId: parsedEffectsLog.effectsLogId,
        rulesApplied: [
          "NON_ARTIFACT_EFFECTS_PRESENT",
          "PARTIAL_NOT_ALLOWED_BY_POLICY",
        ] satisfies RevalidationRule[],

        mode: "PARTIAL",
        code: "PARTIAL_NOT_ALLOWED",
        message:
          "Commit policy forbids PARTIAL but non-artifact effects are present.",
      });
    }

    const allow = parsedEffectsLog.producedEffects
      .filter(isProvisionalArtifactEffect)
      .map((e) => e.objectId);

    const commitAllowList = Array.from(new Set(allow));

    return {
      ok: true as const,
      data: {
        proposalId,
        effectsLog: parsedEffectsLog,
        directive: {
          proposalId,
          outcome: "PARTIAL_COMMIT",
          commitAllowList,
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
    ok: true as const,
    data: {
      proposalId,
      effectsLog: parsedEffectsLog,
      directive: {
        proposalId,
        outcome: "APPROVE_COMMIT",
        commitAllowList: [],
        rulesApplied: [] satisfies RevalidationRule[],
      },
    },
  };
}
