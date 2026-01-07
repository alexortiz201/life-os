import type {
  RevalidationDirectiveReady,
  RevalidationInput,
} from "#types/rna/pipeline/ingestion/revalidation/revalidation.types";
import { guardRevalidation } from "./revalidation.guard";

export function revalidationStage(
  input: RevalidationInput
): RevalidationDirectiveReady {
  const result = guardRevalidation(input);

  if (!result.ok) {
    throw new Error(`${result.code}: ${result.message}`);
  }

  const { data } = result;

  // const commitId = `commit_${Date.now()}`;
  const { proposalId, effectsLog } = data;

  return {
    proposalId,
    revalidation: {
      proposalId,
      outcome: "REJECT_COMMIT",
      commitAllowList: [],
    },
    effectsLog,
  };
}
