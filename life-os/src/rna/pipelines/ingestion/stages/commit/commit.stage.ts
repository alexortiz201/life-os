import { guardTrustPromotion } from "#/domain/trust/trustPromotion.guard";

import type {
  CommitInput,
  CommitRecord,
} from "#types/rna/pipeline/ingestion/commit/commit.types";

import { guardPrecommit } from "./precommit.guard";

export function commitStage(input: CommitInput): CommitRecord {
  const result = guardPrecommit(input);

  if (!result.ok) {
    throw new Error(`${result.code}: ${result.message}`);
  }

  const { ok, data } = result;

  const commitId = `commit_${Date.now()}`;
  const proposalId = data.proposalId;
  const approvedEffects: CommitRecord["approvedEffects"] = [];
  const rejectedEffects: CommitRecord["rejectedEffects"] = data.rejectedEffects;
  const justification: CommitRecord["justification"] = {
    mode: data.mode,
    rulesApplied: data.rulesApplied,
    inputs: [{ commitId, proposalId, allowListCount: data.allowListCount }],
  };
  const promotions: CommitRecord["promotions"] = [];

  if (ok && data.mode === "PARTIAL" && !data.commitEligibleEffects.length) {
    return {
      commitId,
      proposalId,
      approvedEffects,
      rejectedEffects,
      promotions,
      justification,
    };
  }

  const effectsLogId = data.effectsLogId;

  for (const obj of data.commitEligibleEffects) {
    if (obj.effectType !== "ARTIFACT") continue;

    const reason = "Commit stage promotion of provisional execution outputs.";
    const guard = guardTrustPromotion({
      from: obj.trust,
      to: "COMMITTED",
      stage: "COMMIT",
      reason,
    });

    if (!guard.ok) {
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

  return {
    commitId,
    proposalId,
    approvedEffects,
    rejectedEffects,
    promotions,
    justification,
  };
}
