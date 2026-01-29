import { z } from "zod";

import { IngestionContextSnapshotSchema } from "#/domain/snapshot/snapshot.provider.schemas";
import { DECISION_TYPES } from "./validation.const";

export const CommitPolicySchema = z.object({
  allowedModes: z.union([
    z.tuple([z.literal("FULL")]),
    z.tuple([z.literal("FULL"), z.literal("PARTIAL")]),
  ]),
});

export const ValidationSchema = z.object({
  validationId: z.string().min(1),
  commitPolicy: CommitPolicySchema,
  decisionType: z.enum(DECISION_TYPES),
  decidedAt: z.number(),
  justification: z.boolean(),
  attribution: z.array(z.string()).default([]),
  fingerprint: z.string().min(1),
  snapshot: IngestionContextSnapshotSchema,
  // validationDecision: z.string().min(1),
});

export const ValidationInputSchema = z.object({
  proposalId: z.string().min(1),
  snapshotId: z.string().min(1),
});
