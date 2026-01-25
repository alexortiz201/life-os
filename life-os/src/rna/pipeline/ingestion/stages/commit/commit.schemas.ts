import { z } from "zod";

import { RevalidationCommitDirectiveSchema } from "#/rna/pipeline/ingestion/stages/revalidation/revalidation.schemas";
import { ExecutionEffectsLogSchema } from "#/rna/pipeline/ingestion/stages/execution/execution.schemas";

export const CommitInputSchema = z.object({
  proposalId: z.string().min(1),
  revalidation: RevalidationCommitDirectiveSchema,
  effectsLog: ExecutionEffectsLogSchema,
});
