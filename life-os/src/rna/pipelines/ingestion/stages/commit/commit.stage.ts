import { guardTrustPromotion } from "#/domain/trust/trustPromotion.guard";
import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";
import { appendError, hasHaltingErrors } from "#/rna/pipelines/envelope-utils";

import type { CommitRecord } from "#types/rna/pipeline/ingestion/commit/commit.types";
import { guardPreCommit, guardCommit } from "./commit.guard";

export const STAGE = "COMMIT";

const TRUST_PROVISIONAL = "PROVISIONAL";
const TRUST_COMMMITED = "COMMITTED";

const TRUST_FROM = TRUST_PROVISIONAL;
const TRUST_TO = TRUST_COMMMITED;

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
      stage: STAGE,
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
  const rejectedEffects: CommitRecord["rejectedEffects"] = [
    ...data.effects.rejected.artifacts,
    ...data.effects.rejected.events,
  ];

  const justification: CommitRecord["justification"] = {
    mode: data.mode,
    rulesApplied: data.rulesApplied,
    inputs: [{ commitId, proposalId, allowListCount: data.allowListCount }],
  };

  const promotions: CommitRecord["promotions"] = [];

  // If PARTIAL with empty allowlist -> commit nothing, still emit record + stage output
  if (data.mode === "PARTIAL" && data.effects.eligible.artifacts.length === 0) {
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

  for (const obj of data.effects.eligible.artifacts) {
    const reason = "Commit stage promotion of provisional execution outputs.";
    const guard = guardTrustPromotion({
      from: obj.trust,
      to: TRUST_TO,
      stage: STAGE,
      reason,
    });

    if (!guard.ok) {
      rejectedEffects.push({
        ...obj,
        originalTrust: TRUST_FROM,
        reasonCode: guard.code,
        reason: guard.message,
      });

      continue;
    }

    approvedEffects.push({
      objectId: obj.objectId,
      kind: obj.kind,
      trust: TRUST_TO,
    });

    promotions.push({
      objectId: obj.objectId,
      from: TRUST_FROM,
      to: TRUST_TO,
      stage: STAGE,
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
