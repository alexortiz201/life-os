import { guardFactory } from "#/platform/pipeline/guard/guard.factory";
import { preGuardFactory } from "#/platform/pipeline/preguard/preguard.factory";
import type {
  EffectDecisionMode,
  EffectDecisionModeOrUnknown,
} from "#/platform/pipeline/pipeline.types";
import type { ArtifactEffect } from "#/domain/effects/effects.types";

import type { SchemaParseParams } from "#/platform/pipeline/guard/guard.factory.types";
import { errorResultFactory } from "#/platform/pipeline/error/error.factory";

import type {
  CommitGuardOutput,
  ProducedEffect,
  GroupedEffects,
  RejectedArtifactEffect,
  CommitRule,
  GuardCommitResult,
  PostGuardCommitInput,
  CommitErrorCode,
  CommitInput,
} from "./commit.types";
import { CommitInputSchema } from "./commit.schemas";
import { STAGE } from "./commit.const";

export const guardPreCommit = preGuardFactory({
  STAGE: "COMMIT",
  CODE: "COMMIT_PREREQ_MISSING",
} as const);

const pluckParams = ({ ids, stages }: SchemaParseParams) => {
  const execution = stages.execution;
  const revalidation = stages.revalidation;

  return {
    proposalId: ids?.proposalId,
    revalidation,
    effectsLog: (execution as any)?.effectsLog,
  } satisfies CommitInput;
};

export const guardCommit = guardFactory({
  STAGE,
  InputSchema: CommitInputSchema,
  code: "INVALID_COMMIT_INPUT",
  parseFailedRule: "PARSE_FAILED",
  pluckParams,
});

export function postGuardCommit(
  input: PostGuardCommitInput,
): GuardCommitResult {
  const { proposalId: pid, revalidation: rv, effectsLog: el } = input.data;
  const error = errorResultFactory<typeof STAGE, CommitErrorCode>({
    stage: STAGE,
    code: "INVALID_COMMIT_INPUT",
    message: "Post guard commit failed",
  });

  const decidedMode: EffectDecisionModeOrUnknown =
    rv.directive.outcome === "PARTIAL_COMMIT"
      ? "PARTIAL"
      : rv.directive.outcome === "APPROVE_COMMIT"
        ? "FULL"
        : "UNKNOWN";

  // Minimal safety: ensure everything is linked to same proposal
  if (rv.proposalId !== pid) {
    return error({
      mode: decidedMode,
      code: "COMMIT_INPUT_MISMATCH",
      message: "revalidation.proposalId does not match proposalId",
      proposalId: pid,
      revalidationDeclaredProposalId: rv.proposalId,
      effectsLogDeclaredProposalId: el.proposalId,
      effectsLogId: el.effectsLogId,
      allowListCount: rv.directive.commitAllowList.length,
      rulesApplied: [
        "PROPOSAL_ID_MISMATCH_REVALIDATION",
      ] satisfies CommitRule[],
    });
  }

  if (el.proposalId !== pid) {
    return error({
      mode: decidedMode,
      code: "COMMIT_INPUT_MISMATCH",
      message: "effectsLog.proposalId does not match proposalId",
      proposalId: pid,
      revalidationDeclaredProposalId: rv.proposalId,
      effectsLogDeclaredProposalId: el.proposalId,
      effectsLogId: el.effectsLogId,
      allowListCount: rv.directive.commitAllowList.length,
      rulesApplied: ["PROPOSAL_ID_MISMATCH_EFFECTS_LOG"] satisfies CommitRule[],
    });
  }

  if (!["APPROVE_COMMIT", "PARTIAL_COMMIT"].includes(rv.directive.outcome)) {
    return error({
      mode: decidedMode,
      code: "COMMIT_OUTCOME_UNSUPPORTED",
      message: "partial or full approval required",
      proposalId: pid,
      revalidationDeclaredProposalId: rv.proposalId,
      effectsLogDeclaredProposalId: el.proposalId,
      effectsLogId: el.effectsLogId,
      allowListCount: rv.directive.commitAllowList.length,
      rulesApplied: ["OUTCOME_UNSUPPORTED"] satisfies CommitRule[],
    });
  }

  const commitGuardOutputData: CommitGuardOutput = {
    mode: decidedMode as EffectDecisionMode,
    proposalId: pid,
    effectsLogId: el.effectsLogId,
    allowListCount: rv.directive.commitAllowList.length,
    effects: {
      eligible: {
        artifacts: [],
        events: [],
      },
      rejected: {
        artifacts: [],
        events: [],
      },
      ignored: {
        artifacts: [],
        events: [],
        unknown: [],
      },
    },
    rulesApplied: [],
    outcome: rv.directive.outcome,
  };

  // PARTIAL + empty allowlist => commit nothing
  if (
    rv.directive.outcome === "PARTIAL_COMMIT" &&
    rv.directive.commitAllowList.length === 0
  ) {
    return {
      ok: true,
      data: {
        ...commitGuardOutputData,
        rulesApplied: [
          "PARTIAL_EMPTY_ALLOWLIST_COMMITS_NOTHING",
        ] satisfies CommitRule[],
      },
    };
  }

  const initial: GroupedEffects = {
    all: { artifactIds: [], eventNames: [] },
    provisional: { artifacts: [], events: [] },
    rejected: { artifacts: [], events: [] },
    other: { artifacts: [], events: [], unknown: [] },
  };

  const groupedEffects = (el.producedEffects as ProducedEffect[]).reduce(
    (acc, eff) => {
      if (eff.effectType === "ARTIFACT") {
        if (eff.trust === "PROVISIONAL") {
          acc.provisional.artifacts.push(eff);
        } else {
          acc.rejected.artifacts.push({
            ...eff,
            originalTrust: eff.trust,
            reason: "Trust not PROVISIONAL",
            reasonCode: "NOT_PROVISIONAL",
          });
        }

        acc.all.artifactIds.push(eff.objectId);
        return acc;
      }

      if (eff.effectType === "EVENT") {
        if (eff.trust === "PROVISIONAL") {
          acc.provisional.events.push(eff);
        } else {
          acc.rejected.events.push({
            ...eff,
            originalTrust: eff.trust,
            reason: "Trust not PROVISIONAL",
            reasonCode: "NOT_PROVISIONAL",
          });
        }

        acc.all.eventNames.push(eff.eventName);
        return acc;
      }

      // ✅ eff is UnknownEffect here (only if UnknownEffect.effectType excludes the literals)
      acc.other.unknown.push(eff);
      return acc;
    },
    initial,
  );

  // In PARTIAL mode, allowlist must reference known produced ARTIFACT ids
  if (rv.directive.outcome === "PARTIAL_COMMIT") {
    const producedSet = new Set(groupedEffects.all.artifactIds);
    const unknownAllowList = rv.directive.commitAllowList.filter(
      (id: string) => !producedSet.has(id),
    );

    if (unknownAllowList.length) {
      return error({
        mode: decidedMode,
        code: "ALLOWLIST_UNKNOWN_OBJECT",
        message: "unknown allowlist object",
        proposalId: pid,
        revalidationDeclaredProposalId: rv.proposalId,
        effectsLogDeclaredProposalId: el.proposalId,
        effectsLogId: el.effectsLogId,
        allowListCount: rv.directive.commitAllowList.length,
        rulesApplied: [
          "PARTIAL_ALLOWLIST_HAS_UNKNOWN_IDS",
        ] satisfies CommitRule[],
      });
    }

    const allowSet = new Set(rv.directive.commitAllowList);
    let allowListEffects: ArtifactEffect[] = [];
    let allowListRejectedEffects: RejectedArtifactEffect[] = [];

    groupedEffects.provisional.artifacts.filter((o) => {
      if (allowSet.has(o.objectId)) {
        allowListEffects.push(o);
      } else {
        allowListRejectedEffects.push({
          ...o,
          originalTrust: o.trust,
          reason: "Missing from allow list.",
          reasonCode: "NOT_ALLOWLIST_OBJECT",
        });
      }
    });

    return {
      ok: true,
      data: {
        ...commitGuardOutputData,
        effects: {
          eligible: {
            artifacts: allowListEffects,
            events: groupedEffects.provisional.events,
          },
          rejected: {
            artifacts: allowListRejectedEffects,
            events: [],
          },
          ignored: {
            artifacts: groupedEffects.other.artifacts,
            events: groupedEffects.other.events,
            unknown: groupedEffects.other.unknown,
          },
        },
        rulesApplied: ["PARTIAL_COMMIT_USE_ALLOWLIST"],
      } satisfies CommitGuardOutput,
    };
  }

  // FULL = all provisional artifacts; allowlist ignored
  return {
    ok: true,
    data: {
      ...commitGuardOutputData,
      effects: {
        eligible: {
          artifacts: groupedEffects.provisional.artifacts,
          events: groupedEffects.provisional.events,
        },
        rejected: {
          artifacts: groupedEffects.rejected.artifacts,
          events: groupedEffects.rejected.events,
        },
        ignored: {
          artifacts: groupedEffects.other.artifacts,
          events: groupedEffects.other.events,
          unknown: groupedEffects.other.unknown,
        },
      },
      rulesApplied: [
        "FULL_COMMIT_ALL_PROVISIONAL_EFFECTS",
        "FULL_IGNORES_ALLOWLIST",
      ],
    } satisfies CommitGuardOutput,
  };
}
