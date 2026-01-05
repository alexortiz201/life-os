import { PrecommitRule } from "./commit.rules";
import { CommitInputSchema } from "./commit.schemas";
import {
  GuardPrecommitResult,
  Mode,
  Trace,
  // RejectedEffect,
  CommitReadyMode,
} from "./commit.types";

const makeErrorResult = ({
  code,
  message,
  trace,
}: {
  code: string;
  message: string;
  trace: Trace;
}) => ({ ok: false as false, code, message, trace });

export function guardPrecommit(input: unknown): GuardPrecommitResult {
  const parsed = CommitInputSchema.safeParse(input);

  if (!parsed.success) {
    const revalidation = (input as any)?.revalidation;
    const mode: Mode =
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
  const mode: Mode =
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
    mode: mode as CommitReadyMode,
    proposalId,
    effectsLogId,
    allowListCount: revalidation.commitAllowList.length,
    eligibleEffects: [],
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

  const provisionalEffects: typeof effectsLog.producedEffects = [];
  const producedEffectsIds = effectsLog.producedEffects.reduce((acc, o) => {
    if (o.trust === "PROVISIONAL") provisionalEffects.push(o);

    acc.push(o.objectId);

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
        eligibleEffects: [...allowListEffects],
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
      eligibleEffects: [...provisionalEffects],
      rejectedEffects: [],
      rulesApplied: [
        "FULL_COMMIT_ALL_PROVISIONAL_EFFECTS",
        "FULL_IGNORES_ALLOWLIST",
      ] satisfies PrecommitRule[],
    },
  };
}
