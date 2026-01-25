import { z } from "zod";
import { makeRawProposalSchema } from "#/domain/proposals/proposals.schemas";
import { KINDS } from "#/domain/scopes/scopes.const";

export const IntakeRawProposalSchema = makeRawProposalSchema(z.enum(KINDS));

export const IntakeInputSchema = z.object({
  proposalId: z.string().min(1),
  rawProposal: IntakeRawProposalSchema,
  // context
});
