import { errorResultFactory } from "#/rna/pipelines/pipeline-utils";
import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";

import type { ArtifactEffect } from "#/types/domain/effects/effects.types";
import type {
  EffectDecisionMode,
  EffectDecisionModeOrUnknown,
} from "#/types/rna/pipeline/pipeline.types";

import type { PrecommitRule } from "#types/rna/pipeline/ingestion/commit/commit.rules";
import { CommitInputSchema } from "#types/rna/pipeline/ingestion/commit/commit.schemas";
import type {
  GuardCommitResult,
  CommitTrace,
} from "#types/rna/pipeline/ingestion/commit/commit.types";
import { appendError } from "#/rna/pipelines/envelope-utils";

const errorResult = errorResultFactory<CommitTrace>();

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

export function guardCommit(env: unknown): GuardCommitResult {
  // 0) fail closed on non-object
  if (!isObject(env)) {
    return errorResult({
      code: "INVALID_COMMIT_INPUT",
      message: "Input invalid",
      trace: {
        mode: "UNKNOWN",
        rulesApplied: ["PARSE_FAILED"] satisfies PrecommitRule[],
      },
    });
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
      code: "INVALID_COMMIT_INPUT",
      message: "Input invalid",
      trace: {
        mode: "UNKNOWN",
        proposalId,
        rulesApplied: ["PARSE_FAILED"] satisfies PrecommitRule[],
      },
    });
  }

  // We only accept commit inputs once revalidation has run
  if ((revalidationStage as any).hasRun !== true) {
    return errorResult({
      code: "INVALID_COMMIT_INPUT",
      message: "Input invalid",
      trace: {
        mode: "UNKNOWN",
        proposalId,
        rulesApplied: ["PARSE_FAILED"] satisfies PrecommitRule[],
      },
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
      code: "INVALID_COMMIT_INPUT",
      message: "Input invalid",
      trace: {
        mode,
        proposalId,
        revalidationDeclaredProposalId: revalidation?.proposalId,
        effectsLogDeclaredProposalId: effectsLog?.proposalId,
        effectsLogId: effectsLog?.effectsLogId ?? ids?.effectsLogId,
        allowListCount: revalidation?.commitAllowList?.length ?? 0,
        rulesApplied: ["PARSE_FAILED"] satisfies PrecommitRule[],
      },
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
      code: "COMMIT_INPUT_MISMATCH",
      message: "revalidation.proposalId does not match proposalId",
      trace: {
        mode: decidedMode,
        proposalId: pid,
        revalidationDeclaredProposalId: rv.proposalId,
        effectsLogDeclaredProposalId: el.proposalId,
        effectsLogId: el.effectsLogId,
        allowListCount: rv.commitAllowList.length,
        rulesApplied: [
          "PROPOSAL_ID_MISMATCH_REVALIDATION",
        ] satisfies PrecommitRule[],
      },
    });
  }

  if (el.proposalId !== pid) {
    return errorResult({
      code: "COMMIT_INPUT_MISMATCH",
      message: "effectsLog.proposalId does not match proposalId",
      trace: {
        mode: decidedMode,
        proposalId: pid,
        revalidationDeclaredProposalId: rv.proposalId,
        effectsLogDeclaredProposalId: el.proposalId,
        effectsLogId: el.effectsLogId,
        allowListCount: rv.commitAllowList.length,
        rulesApplied: [
          "PROPOSAL_ID_MISMATCH_EFFECTS_LOG",
        ] satisfies PrecommitRule[],
      },
    });
  }

  if (!["APPROVE_COMMIT", "PARTIAL_COMMIT"].includes(rv.outcome)) {
    return errorResult({
      code: "COMMIT_OUTCOME_UNSUPPORTED",
      message: "partial or full approval required",
      trace: {
        mode: decidedMode,
        proposalId: pid,
        revalidationDeclaredProposalId: rv.proposalId,
        effectsLogDeclaredProposalId: el.proposalId,
        effectsLogId: el.effectsLogId,
        allowListCount: rv.commitAllowList.length,
        rulesApplied: ["OUTCOME_UNSUPPORTED"] satisfies PrecommitRule[],
      },
    });
  }

  const commitReadyData = {
    mode: decidedMode as EffectDecisionMode,
    proposalId: pid,
    effectsLogId: el.effectsLogId,
    allowListCount: rv.commitAllowList.length,
    commitEligibleEffects: [] as ArtifactEffect[],
    rejectedEffects: [],
    rulesApplied: [] satisfies PrecommitRule[],
  };

  // PARTIAL + empty allowlist => commit nothing
  if (rv.outcome === "PARTIAL_COMMIT" && rv.commitAllowList.length === 0) {
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

  // Eligible = provisional ARTIFACT effects only
  const provisionalArtifacts: ArtifactEffect[] = [];
  const producedArtifactIds = el.producedEffects.reduce((acc, eff) => {
    if (eff.effectType === "ARTIFACT") {
      if (eff.trust === "PROVISIONAL") provisionalArtifacts.push(eff);
      acc.push(eff.objectId);
    }
    return acc;
  }, [] as string[]);

  // In PARTIAL mode, allowlist must reference known produced ARTIFACT ids
  if (rv.outcome === "PARTIAL_COMMIT") {
    const producedSet = new Set(producedArtifactIds);
    const unknownAllowList = rv.commitAllowList.filter(
      (id) => !producedSet.has(id)
    );

    if (unknownAllowList.length) {
      return errorResult({
        code: "ALLOWLIST_UNKNOWN_OBJECT",
        message: "unknown allowlist object",
        trace: {
          mode: decidedMode,
          proposalId: pid,
          revalidationDeclaredProposalId: rv.proposalId,
          effectsLogDeclaredProposalId: el.proposalId,
          effectsLogId: el.effectsLogId,
          allowListCount: rv.commitAllowList.length,
          rulesApplied: [
            "PARTIAL_ALLOWLIST_HAS_UNKNOWN_IDS",
          ] satisfies PrecommitRule[],
        },
      });
    }

    const allowSet = new Set(rv.commitAllowList);
    const allowListEffects = provisionalArtifacts.filter((o) =>
      allowSet.has(o.objectId)
    );

    return {
      ok: true,
      data: {
        ...commitReadyData,
        commitEligibleEffects: allowListEffects,
        rulesApplied: [
          "PARTIAL_COMMIT_USE_ALLOWLIST",
        ] satisfies PrecommitRule[],
      },
    };
  }

  // FULL = all provisional artifacts; allowlist ignored
  return {
    ok: true,
    data: {
      ...commitReadyData,
      commitEligibleEffects: provisionalArtifacts,
      rulesApplied: [
        "FULL_COMMIT_ALL_PROVISIONAL_EFFECTS",
        "FULL_IGNORES_ALLOWLIST",
      ] satisfies PrecommitRule[],
    },
  };
}

export function guardPreCommit(env: IngestionPipelineEnvelope) {
  if (!env.ids.snapshotId) {
    return {
      ok: false,
      env: appendError(env, {
        stage: "COMMIT",
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
        stage: "COMMIT",
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
        stage: "COMMIT",
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
        stage: "COMMIT",
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
