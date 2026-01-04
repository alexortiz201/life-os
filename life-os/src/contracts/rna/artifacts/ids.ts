import { z } from "zod";

export const IdSchema = z.string().min(1);

export const ProposalIdSchema = z.string().min(1);
export type ProposalId = z.infer<typeof ProposalIdSchema>;
