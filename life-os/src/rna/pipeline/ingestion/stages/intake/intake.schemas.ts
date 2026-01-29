import { object, z } from "zod";
import {
  makeRawProposalSchema,
  ProposalRecordSchema,
} from "#/domain/proposals/proposals.schemas";
import { KINDS } from "#/domain/scopes/scopes.const";

export const IntakeRawProposalSchema = makeRawProposalSchema(z.enum(KINDS));

export const IntakeInputSchema = z.object({
  rawProposal: IntakeRawProposalSchema,
});

export const IntakeSchema = z.object({
  intakeId: z.string().min(1),
  proposal: ProposalRecordSchema,
});
