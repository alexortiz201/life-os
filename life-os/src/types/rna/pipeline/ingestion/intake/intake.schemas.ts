import { z } from "zod";
import { IngestionContextSnapshotSchema } from "#/types/domain/snapshot/snapshot.provider.schemas";
import { makeRawProposalSchema } from "#/types/domain/proposals/proposals.schemas";
import { KINDS } from "#/types/domain/scopes/scopes.const";

export const IntakeRawProposalSchema = makeRawProposalSchema(z.enum(KINDS));

export const IntakeSchema = z.object({
  proposalId: z.string().min(1),
  snapshotId: z.string().min(1),
  snapshot: IngestionContextSnapshotSchema,
  validationDecision: z.string().min(1),
});

export const IntakeInputSchema = z.object({
  proposalId: z.string().min(1),
  snapshotId: z.string().min(1),
  // commitPolicy: CommitPolicySchema,
});
