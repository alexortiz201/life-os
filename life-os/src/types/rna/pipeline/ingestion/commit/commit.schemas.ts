import { z } from "zod";

import { RevalidationCommitDirectiveSchema } from "#/types/rna/pipeline/ingestion/revalidation/revalidation.schemas";
import { ExecutionEffectsLogSchema } from "#/types/rna/pipeline/ingestion/execution/execution.schemas";

export const CommitInputSchema = z.object({
  proposalId: z.string().min(1),
  revalidation: RevalidationCommitDirectiveSchema,
  effectsLog: ExecutionEffectsLogSchema,
});
