import { z } from "zod";

import { IntakeInputSchema, IntakeRawProposalSchema } from "./intake.schemas";
import { IngestionPipelineEnvelope } from "../../ingestion.types";

export type IntakeInput = z.infer<typeof IntakeInputSchema>;
export type IntakeRawProposal = z.infer<typeof IntakeRawProposalSchema>;

export type IntakeEnvelope = IngestionPipelineEnvelope & {
  rawProposal: IntakeRawProposal; // required for intake only
};

export type GuardIntakeResult = any;
export type IntakeTrace = any;
