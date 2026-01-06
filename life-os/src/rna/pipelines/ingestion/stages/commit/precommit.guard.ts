import { ArtifactEffect } from "#/types/domain/effects/effects.types";
import {
  EffectDecisionMode,
  EffectDecisionModeOrUnknown,
} from "#/types/rna/pipeline/pipeline.types";
import { PrecommitRule } from "#types/rna/pipeline/ingestion/commit/commit.rules";
import { CommitInputSchema } from "#types/rna/pipeline/ingestion/commit/commit.schemas";
import {
  GuardPrecommitResult,
  PrecommitTrace,
} from "#types/rna/pipeline/ingestion/commit/commit.types";

const makeErrorResult = ({
  code,
  message,
  trace,
}: {
  code: string;
  message: string;
  trace: PrecommitTrace;
}) => ({ ok: false as false, code, message, trace });

export function guardPrecommit(input: unknown): GuardPrecommitResult {
  const parsed = CommitInputSchema.safeParse(input);

  if (!parsed.success) {
    const revalidation = (input as any)?.revalidation;
    const mode: EffectDecisionModeOrUnknown =
      revalidation?.outcome === "PARTIAL_COMMIT"
        ? "PARTIAL"
        : revalidation?.outcome === "APPROVE_COMMIT"
        ? "FULL"
        : "UNKNOWN";

    return makeErrorResult({
      code: "INVALID_COMMIT_INPUT",
      message: "Input invalid",
      trace: {
        mode,
        proposalId: (input as any)?.proposalId,
        revalidationDeclaredProposalId: revalidation?.proposalId,
        effectsLogDeclaredProposalId: (input as any)?.effectsLog?.proposalId,
        effectsLogId: (input as any)?.effectsLog?.effectsLogId,
        allowListCount: revalidation?.commitAllowList?.length ?? 0,
        rulesApplied: ["PARSE_FAILED"] satisfies PrecommitRule[],
      },
    });
  }

  const data = parsed.data;
  const { revalidation, effectsLog, proposalId } = data;
  const mode: EffectDecisionModeOrUnknown =
    revalidation.outcome === "PARTIAL_COMMIT"
      ? "PARTIAL"
      : revalidation.outcome === "APPROVE_COMMIT"
      ? "FULL"
      : "UNKNOWN";

  // Minimal safety: ensure everything is linked to the same proposal
  if (revalidation.proposalId !== proposalId) {
    return makeErrorResult({
      code: "COMMIT_INPUT_MISMATCH",
      message: "revalidation.proposalId does not match proposalId",
      trace: {
        mode,
        proposalId,
        revalidationDeclaredProposalId: revalidation.proposalId,
        effectsLogDeclaredProposalId: effectsLog.proposalId,
        effectsLogId: effectsLog.effectsLogId,
        allowListCount: revalidation.commitAllowList.length,
        rulesApplied: [
          "PROPOSAL_ID_MISMATCH_REVALIDATION",
        ] satisfies PrecommitRule[],
      },
    });
  }
  if (effectsLog.proposalId !== proposalId) {
    return makeErrorResult({
      code: "COMMIT_INPUT_MISMATCH",
      message: "effectsLog.proposalId does not match proposalId",
      trace: {
        mode,
        proposalId,
        revalidationDeclaredProposalId: revalidation.proposalId,
        effectsLogDeclaredProposalId: effectsLog.proposalId,
        effectsLogId: effectsLog.effectsLogId,
        allowListCount: revalidation.commitAllowList.length,
        rulesApplied: [
          "PROPOSAL_ID_MISMATCH_EFFECTS_LOG",
        ] satisfies PrecommitRule[],
      },
    });
  }

  if (!["APPROVE_COMMIT", "PARTIAL_COMMIT"].includes(revalidation.outcome)) {
    return makeErrorResult({
      code: "COMMIT_OUTCOME_UNSUPPORTED",
      message: "partial or full approval required",
      trace: {
        mode,
        proposalId,
        revalidationDeclaredProposalId: revalidation.proposalId,
        effectsLogDeclaredProposalId: effectsLog.proposalId,
        effectsLogId: effectsLog.effectsLogId,
        allowListCount: revalidation.commitAllowList.length,
        rulesApplied: ["OUTCOME_UNSUPPORTED"] satisfies PrecommitRule[],
      },
    });
  }

  const effectsLogId = effectsLog.effectsLogId;
  const commitReadyData = {
    mode: mode as EffectDecisionMode,
    proposalId,
    effectsLogId,
    allowListCount: revalidation.commitAllowList.length,
    commitEligibleEffects: [],
    rejectedEffects: [],
    rulesApplied: [] satisfies PrecommitRule[],
  };

  if (
    revalidation.outcome === "PARTIAL_COMMIT" &&
    !revalidation.commitAllowList.length
  ) {
    return {
      ok: true,
      data: {
        ...commitReadyData,
        rulesApplied: [
          "PARTIAL_EMPTY_ALLOWLIST_COMMITS_NOTHING",
        ] satisfies PrecommitRule[],
      },
    };
  }

  const provisionalEffects: ArtifactEffect[] = [];
  const producedEffectsIds = effectsLog.producedEffects.reduce((acc, o) => {
    if (o.effectType === "ARTIFACT") {
      if (o.trust === "PROVISIONAL") provisionalEffects.push(o);

      acc.push(o.objectId);
    }

    return acc;
  }, [] as string[]);
  const producedEffectsIdsSet = new Set(producedEffectsIds);
  const unknownAllowListEffects = revalidation.commitAllowList.filter(
    (s) => !producedEffectsIdsSet.has(s)
  );

  if (
    revalidation.outcome !== "APPROVE_COMMIT" &&
    unknownAllowListEffects.length
  ) {
    return makeErrorResult({
      code: "ALLOWLIST_UNKNOWN_OBJECT",
      message: "unknown allowlist object",
      trace: {
        mode,
        proposalId,
        revalidationDeclaredProposalId: revalidation.proposalId,
        effectsLogDeclaredProposalId: effectsLog.proposalId,
        effectsLogId: effectsLog.effectsLogId,
        allowListCount: revalidation.commitAllowList.length,
        rulesApplied: [
          "PARTIAL_ALLOWLIST_HAS_UNKNOWN_IDS",
        ] satisfies PrecommitRule[],
      },
    });
  }

  if (revalidation.outcome === "PARTIAL_COMMIT") {
    const commitAllowListSet = new Set(revalidation.commitAllowList);
    const allowListEffects = provisionalEffects.filter((o) =>
      commitAllowListSet.has(o.objectId)
    );

    return {
      ok: true,
      data: {
        ...commitReadyData,
        commitEligibleEffects: [...allowListEffects],
        rejectedEffects: [],
        rulesApplied: [
          "PARTIAL_COMMIT_USE_ALLOWLIST",
        ] satisfies PrecommitRule[],
      },
    };
  }

  return {
    ok: true,
    data: {
      ...commitReadyData,
      commitEligibleEffects: [...provisionalEffects],
      rejectedEffects: [],
      rulesApplied: [
        "FULL_COMMIT_ALL_PROVISIONAL_EFFECTS",
        "FULL_IGNORES_ALLOWLIST",
      ] satisfies PrecommitRule[],
    },
  };
}
