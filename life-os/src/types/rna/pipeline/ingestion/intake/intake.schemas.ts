import { z } from "zod";
import { ContextSnapshotSchema } from "#/types/domain/snapshot/snapshot.provider.schemas";

export const IntakeProposalSchema = z.object({
  intent: z.string().min(1),
  actor: z.string().min(1),
  targetEntity: z.string().min(1),
  targetScope: z.object({ kind: z.string().min(1) }),
  dependencies: [],
  impact: z.string().min(1),
  reversibilityClaim: z.string().min(1),
});

export const IntakeSchema = z.object({
  proposalId: z.string().min(1),
  snapshotId: z.string().min(1),
  snapshot: ContextSnapshotSchema,
  validationDecision: z.string().min(1),
});

export const IntakeInputSchema = z.object({
  proposalId: z.string().min(1),
  snapshotId: z.string().min(1),
  // commitPolicy: CommitPolicySchema,
});
