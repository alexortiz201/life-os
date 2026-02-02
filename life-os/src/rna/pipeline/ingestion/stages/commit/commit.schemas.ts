import { z } from "zod";

import { RevalidationSchema } from "#/rna/pipeline/ingestion/stages/revalidation/revalidation.schemas";
import { ExecutionEffectsLogSchema } from "#/rna/pipeline/ingestion/stages/execution/execution.schemas";

export const CommitInputSchema = z.object({
  proposalId: z.string().min(1),
  revalidation: RevalidationSchema,
  effectsLog: ExecutionEffectsLogSchema,
});
