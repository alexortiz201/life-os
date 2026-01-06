import { z } from "zod";

import { COMMIT_OUTCOMES } from "#types/rna/pipeline/ingestion/commit/commitDecision.constants";

export const RevalidationCommitDirectiveSchema = z.object({
  proposalId: z.string().min(1),
  outcome: z.enum(COMMIT_OUTCOMES),
  commitAllowList: z.string().array().default([]),
});
