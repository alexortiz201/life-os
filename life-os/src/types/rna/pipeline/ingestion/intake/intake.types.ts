import { z } from "zod";

import { IntakeSchema, IntakeRawProposalSchema } from "./intake.schemas";

export type Intake = z.infer<typeof IntakeSchema>;
export type IntakeRawProposal = z.infer<typeof IntakeRawProposalSchema>;

export type GuardIntakeResult = any;
export type IntakeTrace = any;
