import { guardTrustPromotion } from "#/domain/trust/trustPromotion.guard";
import { CommitRecord } from "./commit.types";
import { guardPrecommit } from "./precommit.guard";

export function commitStage(input: unknown): CommitRecord {
  const result = guardPrecommit(input);

  if (!result.ok) {
    throw new Error(`${result.code}: ${result.message}`);
  }

  const { ok, code, data } = result;

  const commitId = `commit_${Date.now()}`;
  const proposalId = data.proposalId;
  const committedObjects: CommitRecord["committedObjects"] = [];
  const promotions: CommitRecord["promotions"] = [];

  if (ok && code === "PARTIAL_COMMIT_EMPTY_ALLOWLIST") {
    return {
      commitId,
      proposalId,
      committedObjects,
      promotions,
    };
  }

  const effectsLogId = data.effectsLog.effectsLogId;

  for (const obj of data.commitSet) {
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

    committedObjects.push({
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
    committedObjects,
    promotions,
  };
}
