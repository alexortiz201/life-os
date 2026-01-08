import { RevalidationInputSchema } from "#types/rna/pipeline/ingestion/revalidation/revalidation.schemas";
import {
  GuardRevalidationResult,
  RevalidationInput,
  RevalidationTrace,
} from "#types/rna/pipeline/ingestion/revalidation/revalidation.types";
import { errorResultFactory } from "#/rna/pipelines/pipeline-utils";
import type { RevalidationRule } from "#types/rna/pipeline/ingestion/revalidation/revalidation.rules";

const errorResult = errorResultFactory<RevalidationTrace>();

export function guardRevalidation(
  input: RevalidationInput
): GuardRevalidationResult {
  const parsed = RevalidationInputSchema.safeParse(input);

  if (!parsed.success) {
    return errorResult({
      code: "INVALID_REVALIDATION_INPUT",
      message: "Input invalid",
      trace: {
        mode: "UNKNOWN",
        proposalId: (input as any)?.proposalId,
        // revalidationDeclaredProposalId: "", //revalidation?.proposalId,
        effectsLogDeclaredProposalId: (input as any)?.effectsLog?.proposalId,
        effectsLogId: (input as any)?.effectsLog?.effectsLogId,
        allowListCount: 0, // revalidation?.commitAllowList?.length ?? 0,
        rulesApplied: ["DRIFT_DETECTED"] satisfies RevalidationRule[],
      },
    });
  }

  const { proposalId, effectsLog } = parsed.data;

  return {
    ok: true,
    data: {
      proposalId,
      effectsLog,
      revalidation: {
        proposalId: "",
        outcome: "APPROVE_COMMIT",
        commitAllowList: [],
        rulesApplied: [] satisfies RevalidationRule[],
      },
    },
  };
}
