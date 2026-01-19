import { ContextSnapshotSchema } from "#/types/domain/snapshot/snapshot.provider.schemas";
import { z } from "zod";

export const CommitPolicySchema = z.object({
  allowedModes: z.union([
    z.tuple([z.literal("FULL")]),
    z.tuple([z.literal("FULL"), z.literal("PARTIAL")]),
  ]),
});

export const ValidationSchema = z.object({
  proposalId: z.string().min(1),
  snapshotId: z.string().min(1),
  snapshot: ContextSnapshotSchema,
  validationDecision: z.string().min(1),
});

export const ValidationInputSchema = z.object({
  proposalId: z.string().min(1),
  snapshotId: z.string().min(1),
  // commitPolicy: CommitPolicySchema,
});
