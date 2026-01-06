// import { guardTrustPromotion } from "#/domain/trust/trustPromotion.guard";
import type { RevalidationCommitDirective } from "#types/rna/pipeline/ingestion/revalidation/revalidation.types";
// import { guardPrecommit } from "../precommit.guard";

export function revalidationStage(input: unknown): RevalidationCommitDirective {
  // const result = guardPrecommit(input);

  // if (!result.ok) {
  //   throw new Error(`${result.code}: ${result.message}`);
  // }

  // const { ok, data } = result;

  // const commitId = `commit_${Date.now()}`;
  // const proposalId = data.proposalId;

  return { proposalId: "", outcome: "REJECT_COMMIT", commitAllowList: [] };
}
