import { z } from "zod";
import { guardTrustPromotion } from "#/domain/trust/trustPromotion.guard";
import { TrustLevelSchema } from "#/domain/trust/trust.schemas";

const ProducedObjectSchema = z.object({
  objectId: z.string().min(1),
  kind: z.string().min(1), // NOTE, REPORT, ARTIFACT, etc (we'll tighten later)
  trust: TrustLevelSchema,
});

const ExecutionEffectsLogSchema = z.object({
  effectsLogId: z.string().min(1),
  proposalId: z.string().min(1),
  producedObjects: z.array(ProducedObjectSchema),
});

const RevalidationDecisionSchema = z.object({
  proposalId: z.string().min(1),
  outcome: z.enum(["APPROVE_COMMIT", "PARTIAL_COMMIT", "REJECT_COMMIT"]),
  commitAllowList: z.string().array().default([]),
});

const CommitInputSchema = z.object({
  proposalId: z.string().min(1),
  revalidation: RevalidationDecisionSchema,
  effectsLog: ExecutionEffectsLogSchema,
});

export type CommitInput = z.infer<typeof CommitInputSchema>;

export type TrustPromotionRecord = {
  objectId: string;
  from: "PROVISIONAL";
  to: "COMMITTED";
  stage: "COMMIT";
  reason: string;
  proposalId: string;
  effectsLogId: string;
  commitId: string;
};

export type CommitRecord = {
  commitId: string;
  proposalId: string;
  committedObjects: Array<{
    objectId: string;
    kind: string;
    trust: "COMMITTED";
  }>;
  promotions: Array<TrustPromotionRecord>;
};

export function commitStage(input: unknown): CommitRecord {
  const parsed = CommitInputSchema.parse(input);

  // Minimal safety: ensure everything is linked to the same proposal
  if (parsed.revalidation.proposalId !== parsed.proposalId) {
    throw new Error(
      "COMMIT_INPUT_MISMATCH: revalidation.proposalId does not match proposalId"
    );
  }
  if (parsed.effectsLog.proposalId !== parsed.proposalId) {
    throw new Error(
      "COMMIT_INPUT_MISMATCH: effectsLog.proposalId does not match proposalId"
    );
  }

  if (
    !["APPROVE_COMMIT", "PARTIAL_COMMIT"].includes(parsed.revalidation.outcome)
  ) {
    throw new Error(
      "COMMIT_OUTCOME_UNSUPPORTED: partial or full approval required"
    );
  }

  const committedObjects: CommitRecord["committedObjects"] = [];
  const promotions: CommitRecord["promotions"] = [];

  if (
    parsed.revalidation.outcome === "PARTIAL_COMMIT" &&
    !parsed.revalidation.commitAllowList.length
  ) {
    return {
      commitId: `commit_${Date.now()}`,
      proposalId: parsed.proposalId,
      committedObjects,
      promotions,
    };
  }

  const commitAllowListSet = new Set(parsed.revalidation.commitAllowList);
  const producedObjectsIdsSet = new Set(
    parsed.effectsLog.producedObjects.map((o) => o.objectId)
  );
  const invalidAllowListObjects = parsed.revalidation.commitAllowList.filter(
    (s) => !producedObjectsIdsSet.has(s)
  );

  if (invalidAllowListObjects.length) {
    throw new Error("ALLOWLIST_UNKNOWN_OBJECT: unknown allowlist object");
  }

  const isPartialCommit = parsed.revalidation.outcome === "PARTIAL_COMMIT";

  const info = {
    commitId: `commit_${Date.now()}`,
    proposalId: parsed.proposalId,
  };
  const effectsLogId = parsed.effectsLog.effectsLogId;

  for (const obj of parsed.effectsLog.producedObjects) {
    if (obj.trust !== "PROVISIONAL") continue;
    if (isPartialCommit && !commitAllowListSet.has(obj.objectId)) continue;

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
      ...info,
    });
  }

  return {
    ...info,
    committedObjects,
    promotions,
  };
}
