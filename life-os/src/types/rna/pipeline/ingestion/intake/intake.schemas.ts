import { z } from "zod";
import { makeRawProposalSchema } from "#/types/domain/proposals/proposals.schemas";
import { KINDS } from "#/types/domain/scopes/scopes.const";

export const IntakeRawProposalSchema = makeRawProposalSchema(z.enum(KINDS));

export const IntakeInputSchema = z.object({
  proposalId: z.string().min(1),
  rawProposal: IntakeRawProposalSchema,
  // context
});
