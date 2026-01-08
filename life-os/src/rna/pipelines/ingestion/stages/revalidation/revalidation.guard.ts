import { RevalidationInputSchema } from "#types/rna/pipeline/ingestion/revalidation/revalidation.schemas";
import type {
  GuardRevalidationResult,
  RevalidationInput,
  RevalidationTrace,
} from "#types/rna/pipeline/ingestion/revalidation/revalidation.types";
import { errorResultFactory } from "#/rna/pipelines/pipeline-utils";
import type { RevalidationRule } from "#types/rna/pipeline/ingestion/revalidation/revalidation.rules";
import { isProvisionalArtifactEffect } from "#/domain/effects/effects.guards";

const errorResult = errorResultFactory<RevalidationTrace>();

function policyAllowsPartial(allowedModes: ["FULL"] | ["FULL", "PARTIAL"]) {
  return allowedModes.length === 2 && allowedModes[1] === "PARTIAL";
}

export function guardRevalidation(
  input: RevalidationInput
): GuardRevalidationResult {
  const parsed = RevalidationInputSchema.safeParse(input);

  if (!parsed.success) {
    return errorResult({
      code: "INVALID_REVALIDATION_INPUT",
      message: "Input invalid",
      trace: {
        mode: "UNKNOWN",
        proposalId: (input as any)?.proposalId,
        effectsLogDeclaredProposalId: (input as any)?.effectsLog?.proposalId,
        effectsLogId: (input as any)?.effectsLog?.effectsLogId,
        allowListCount:
          (input as any)?.revalidation?.commitAllowList?.length ?? 0,
        rulesApplied: ["PARSE_FAILED"] satisfies RevalidationRule[],
      },
    });
  }

  const { proposalId, effectsLog, commitPolicy } = parsed.data;

  // Drift surrogate: proposalId mismatch with effectsLog.proposalId
  if (effectsLog.proposalId !== proposalId) {
    return {
      ok: true,
      data: {
        proposalId,
        effectsLog,
        revalidation: {
          proposalId,
          outcome: "REJECT_COMMIT",
          commitAllowList: [],
          rulesApplied: ["DRIFT_DETECTED"] satisfies RevalidationRule[],
        },
      },
    };
  }

  // Compute “needs PARTIAL” if any non-ARTIFACT effects exist
  const hasNonArtifact = effectsLog.producedEffects.some(
    (e: any) => e?.effectType && e.effectType !== "ARTIFACT"
  );

  if (hasNonArtifact) {
    if (!policyAllowsPartial(commitPolicy.allowedModes)) {
      return errorResult({
        code: "PARTIAL_NOT_ALLOWED",
        message:
          "Commit policy forbids PARTIAL but non-artifact effects are present.",
        trace: {
          mode: "PARTIAL",
          proposalId,
          effectsLogDeclaredProposalId: effectsLog.proposalId,
          effectsLogId: effectsLog.effectsLogId,
          rulesApplied: [
            "NON_ARTIFACT_EFFECTS_PRESENT",
            "PARTIAL_NOT_ALLOWED_BY_POLICY",
          ] satisfies RevalidationRule[],
        },
      });
    }

    const allow = effectsLog.producedEffects
      .filter(isProvisionalArtifactEffect)
      .map((e) => e.objectId);

    return {
      ok: true,
      data: {
        proposalId,
        effectsLog,
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

  // Otherwise: full approval
  return {
    ok: true,
    data: {
      proposalId,
      effectsLog,
      revalidation: {
        proposalId,
        outcome: "APPROVE_COMMIT",
        commitAllowList: [],
        rulesApplied: [] satisfies RevalidationRule[],
      },
    },
  };
}
