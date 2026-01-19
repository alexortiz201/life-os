import { z } from "zod";

import { IntakeSchema, IntakeProposalSchema } from "./intake.schemas";

export type Intake = z.infer<typeof IntakeSchema>;
export type IntakeProposal = z.infer<typeof IntakeProposalSchema>;

export type GuardIntakeResult = any;
export type IntakeTrace = any;
