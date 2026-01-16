import { z } from "zod";

import { CommitPolicySchema } from "../revalidation/revalidation.schemas";

export const PlanningSchema = z.object({
  planId: z.string().min(1),
  proposalId: z.string().min(1),
  plan: z.string().array().default([]),
});

export const PlanningInputSchema = z.object({
  proposalId: z.string().min(1),
  snapshotId: z.string().min(1),
  validationDecision: z.string().min(1),
  planId: z.string().min(1),
  plan: z.string().array().default([]),
  commitPolicy: CommitPolicySchema,
});
