import { guardTrustPromotion } from "#/domain/trust/trustPromotion.guard";
import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";
import { appendError, hasHaltingErrors } from "#/rna/pipelines/envelope-utils";

import type { CommitRecord } from "#types/rna/pipeline/ingestion/commit/commit.types";
import { guardPreCommit, guardCommit } from "./commit.guard";

export function commitStage(
  env: IngestionPipelineEnvelope
): IngestionPipelineEnvelope {
  // 0) fail closed if earlier stage produced HALT errors
  if (hasHaltingErrors(env)) return env;

  // 1) prereqs
  const preReqResult = guardPreCommit(env);

  if (!preReqResult.ok) return preReqResult.env;

  // 2) run guard
  const result = guardCommit(env);

  if (!result.ok) {
    return appendError(env, {
      stage: "COMMIT",
      severity: "HALT",
      code: result.code,
      message: result.message,
      trace: result.trace,
      at: Date.now(),
    });
  }

  const { data } = result;

  // 3) build commit record
  const ranAt = Date.now();
  const commitId = `commit_${ranAt}`;
  const proposalId = data.proposalId;

  const approvedEffects: CommitRecord["approvedEffects"] = [];
  const rejectedEffects: CommitRecord["rejectedEffects"] = data.rejectedEffects;

  const justification: CommitRecord["justification"] = {
    mode: data.mode,
    rulesApplied: data.rulesApplied,
    inputs: [{ commitId, proposalId, allowListCount: data.allowListCount }],
  };

  const promotions: CommitRecord["promotions"] = [];

  // If PARTIAL with empty allowlist -> commit nothing, still emit record + stage output
  if (data.mode === "PARTIAL" && data.commitEligibleEffects.length === 0) {
    const record: CommitRecord = {
      commitId,
      proposalId,
      approvedEffects,
      rejectedEffects,
      promotions,
      justification,
    };

    return {
      ...env,
      ids: {
        ...env.ids,
        commitId,
      },
      stages: {
        ...env.stages,
        commit: {
          hasRun: true,
          ranAt,
          observed: {
            proposalId: env.ids.proposalId,
            snapshotId: env.ids.snapshotId,
            revalidationId: env.ids.revalidationId,
            effectsLogId: env.ids.effectsLogId,
          },
          ...record,
        },
      },
    };
  }

  const effectsLogId = data.effectsLogId;

  for (const obj of data.commitEligibleEffects) {
    // defensive; guard already filtered to artifacts
    if (obj.effectType !== "ARTIFACT") continue;

    const reason = "Commit stage promotion of provisional execution outputs.";
    const guard = guardTrustPromotion({
      from: obj.trust,
      to: "COMMITTED",
      stage: "COMMIT",
      reason,
    });

    if (!guard.ok) {
      // internal invariant breach (still safe to throw)
      throw new Error(`${guard.code}: ${guard.message}`);
    }

    approvedEffects.push({
      objectId: obj.objectId,
      kind: obj.kind,
      trust: "COMMITTED",
    });

    promotions.push({
      objectId: obj.objectId,
      from: "PROVISIONAL",
      to: "COMMITTED",
      stage: "COMMIT",
      reason,
      effectsLogId,
      commitId,
      proposalId,
    });
  }

  const record: CommitRecord = {
    commitId,
    proposalId,
    approvedEffects,
    rejectedEffects,
    promotions,
    justification,
  };

  return {
    ...env,
    ids: {
      ...env.ids,
      commitId,
    },
    stages: {
      ...env.stages,
      commit: {
        hasRun: true,
        ranAt,
        observed: {
          proposalId: env.ids.proposalId,
          snapshotId: env.ids.snapshotId,
          revalidationId: env.ids.revalidationId,
          effectsLogId: env.ids.effectsLogId,
        },
        ...record,
      },
    },
  };
}
