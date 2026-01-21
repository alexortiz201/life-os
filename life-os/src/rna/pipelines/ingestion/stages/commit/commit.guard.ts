import { errorResultFactory } from "#/rna/pipelines/pipeline-utils";
import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";

import type {
  ArtifactEffect,
  EventEffect,
  UnknownEffect,
} from "#/types/domain/effects/effects.types";
import type {
  EffectDecisionMode,
  EffectDecisionModeOrUnknown,
} from "#/types/rna/pipeline/pipeline.types";

import type { PrecommitRule } from "#/types/rna/pipeline/ingestion/commit/commit.rules";
import { CommitInputSchema } from "#/types/rna/pipeline/ingestion/commit/commit.schemas";
import type {
  GuardCommitResult,
  CommitGuardOutput,
  RejectedEffect,
} from "#/types/rna/pipeline/ingestion/commit/commit.types";
import { appendError } from "#/rna/envelope/envelope-utils";

import { STAGE } from "./commit.stage";

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

export function guardCommit(env: unknown): GuardCommitResult {
  const errorResult = errorResultFactory({
    stage: STAGE,
    code: "INVALID_COMMIT_INPUT",
    message: "Input invalid",
  });
  const rulesApplied = ["PARSE_FAILED"] satisfies PrecommitRule[];

  // 0) fail closed on non-object
  if (!isObject(env)) {
    return errorResult({ rulesApplied });
  }

  const ids = isObject((env as any).ids) ? (env as any).ids : undefined;
  const stages = isObject((env as any).stages)
    ? (env as any).stages
    : undefined;

  const proposalId =
    typeof ids?.proposalId === "string"
      ? (ids.proposalId as string)
      : undefined;

  const revalidationStage = stages?.revalidation;

  // need at least proposalId + revalidation stage
  if (!proposalId || !isObject(revalidationStage)) {
    return errorResult({
      proposalId,
      rulesApplied,
    });
  }

  // We only accept commit inputs once revalidation has run
  if ((revalidationStage as any).hasRun !== true) {
    return errorResult({
      proposalId,
      rulesApplied,
    });
  }

  // Pluck canonical commit inputs directly from revalidation stage output
  const revalidation =
    (revalidationStage as any).directive ??
    (revalidationStage as any).revalidation;

  const effectsLog = (revalidationStage as any).effectsLog;

  const mode: EffectDecisionModeOrUnknown =
    revalidation?.outcome === "PARTIAL_COMMIT"
      ? "PARTIAL"
      : revalidation?.outcome === "APPROVE_COMMIT"
      ? "FULL"
      : "UNKNOWN";

  // Candidate is ONLY a schema-shaped view of what we plucked from env
  const candidate = {
    proposalId,
    revalidation,
    effectsLog,
  };

  const parsed = CommitInputSchema.safeParse(candidate);

  if (!parsed.success) {
    return errorResult({
      mode,
      proposalId,
      revalidationDeclaredProposalId: revalidation?.proposalId,
      effectsLogDeclaredProposalId: effectsLog?.proposalId,
      effectsLogId: effectsLog?.effectsLogId ?? ids?.effectsLogId,
      allowListCount: revalidation?.commitAllowList?.length ?? 0,
      rulesApplied,
    });
  }

  const { proposalId: pid, revalidation: rv, effectsLog: el } = parsed.data;

  const decidedMode: EffectDecisionModeOrUnknown =
    rv.outcome === "PARTIAL_COMMIT"
      ? "PARTIAL"
      : rv.outcome === "APPROVE_COMMIT"
      ? "FULL"
      : "UNKNOWN";

  // Minimal safety: ensure everything is linked to same proposal
  if (rv.proposalId !== pid) {
    return errorResult({
      mode: decidedMode,
      code: "COMMIT_INPUT_MISMATCH",
      message: "revalidation.proposalId does not match proposalId",
      proposalId: pid,
      revalidationDeclaredProposalId: rv.proposalId,
      effectsLogDeclaredProposalId: el.proposalId,
      effectsLogId: el.effectsLogId,
      allowListCount: rv.commitAllowList.length,
      rulesApplied: [
        "PROPOSAL_ID_MISMATCH_REVALIDATION",
      ] satisfies PrecommitRule[],
    });
  }

  if (el.proposalId !== pid) {
    return errorResult({
      mode: decidedMode,
      code: "COMMIT_INPUT_MISMATCH",
      message: "effectsLog.proposalId does not match proposalId",
      proposalId: pid,
      revalidationDeclaredProposalId: rv.proposalId,
      effectsLogDeclaredProposalId: el.proposalId,
      effectsLogId: el.effectsLogId,
      allowListCount: rv.commitAllowList.length,
      rulesApplied: [
        "PROPOSAL_ID_MISMATCH_EFFECTS_LOG",
      ] satisfies PrecommitRule[],
    });
  }

  if (!["APPROVE_COMMIT", "PARTIAL_COMMIT"].includes(rv.outcome)) {
    return errorResult({
      mode: decidedMode,
      code: "COMMIT_OUTCOME_UNSUPPORTED",
      message: "partial or full approval required",
      proposalId: pid,
      revalidationDeclaredProposalId: rv.proposalId,
      effectsLogDeclaredProposalId: el.proposalId,
      effectsLogId: el.effectsLogId,
      allowListCount: rv.commitAllowList.length,
      rulesApplied: ["OUTCOME_UNSUPPORTED"] satisfies PrecommitRule[],
    });
  }

  const commitGuardOutputData: CommitGuardOutput = {
    mode: decidedMode as EffectDecisionMode,
    proposalId: pid,
    effectsLogId: el.effectsLogId,
    allowListCount: rv.commitAllowList.length,
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
    outcome: rv.outcome,
  };

  // PARTIAL + empty allowlist => commit nothing
  if (rv.outcome === "PARTIAL_COMMIT" && rv.commitAllowList.length === 0) {
    return {
      ok: true,
      data: {
        ...commitGuardOutputData,
        rulesApplied: [
          "PARTIAL_EMPTY_ALLOWLIST_COMMITS_NOTHING",
        ] satisfies PrecommitRule[],
      },
    };
  }

  // Eligible = provisional ARTIFACT effects only
  type ProducedEffect = ArtifactEffect | EventEffect | UnknownEffect;

  type Grouped = {
    all: {
      artifactIds: string[];
      eventNames: string[];
    };
    provisional: {
      artifacts: ArtifactEffect[];
      events: EventEffect[];
    };
    rejected: {
      artifacts: RejectedEffect[];
      events: RejectedEffect[];
    };
    other: {
      artifacts: ArtifactEffect[];
      events: EventEffect[];
      unknown: UnknownEffect[];
    };
  };

  const initial: Grouped = {
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
    initial
  );

  // In PARTIAL mode, allowlist must reference known produced ARTIFACT ids
  if (rv.outcome === "PARTIAL_COMMIT") {
    const producedSet = new Set(groupedEffects.all.artifactIds);
    const unknownAllowList = rv.commitAllowList.filter(
      (id) => !producedSet.has(id)
    );

    if (unknownAllowList.length) {
      return errorResult({
        mode: decidedMode,
        code: "ALLOWLIST_UNKNOWN_OBJECT",
        message: "unknown allowlist object",
        proposalId: pid,
        revalidationDeclaredProposalId: rv.proposalId,
        effectsLogDeclaredProposalId: el.proposalId,
        effectsLogId: el.effectsLogId,
        allowListCount: rv.commitAllowList.length,
        rulesApplied: [
          "PARTIAL_ALLOWLIST_HAS_UNKNOWN_IDS",
        ] satisfies PrecommitRule[],
      });
    }

    const allowSet = new Set(rv.commitAllowList);
    let allowListEffects: ArtifactEffect[] = [];
    let allowListRejectedEffects: RejectedEffect[] = [];

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

export function guardPreCommit(env: IngestionPipelineEnvelope) {
  if (!env.ids.snapshotId) {
    return {
      ok: false,
      env: appendError(env, {
        stage: STAGE,
        severity: "HALT",
        code: "COMMIT_PREREQ_MISSING",
        message: "Missing snapshotId required for commit.",
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
        code: "COMMIT_PREREQ_MISSING",
        message: "Missing effectsLogId required for commit.",
        trace: {
          proposalId: env.ids.proposalId,
          effectsLogId: env.ids.effectsLogId,
        },
        at: Date.now(),
      }),
    };
  }

  if (!env.stages.revalidation.hasRun) {
    return {
      ok: false,
      env: appendError(env, {
        stage: STAGE,
        severity: "HALT",
        code: "COMMIT_PREREQ_MISSING",
        message: "Revalidation stage has not run.",
        trace: {
          proposalId: env.ids.proposalId,
          revalidationHasRun: false,
        },
        at: Date.now(),
      }),
    };
  }

  if (!env.ids.revalidationId) {
    return {
      ok: false,
      env: appendError(env, {
        stage: STAGE,
        severity: "HALT",
        code: "COMMIT_PREREQ_MISSING",
        message: "Missing revalidationId required for commit.",
        trace: {
          proposalId: env.ids.proposalId,
          revalidationId: env.ids.revalidationId,
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
