import { z } from "zod";
import { ActorSchema } from "../artifacts/artifact_base";

export const RawProposalSchema = z.object({
  intent: z.string().min(1),

  actor: ActorSchema,

  targetEntity: z.string().min(1),
  targetSelector: z.record(z.string(), z.unknown()).optional(),

  targetScope: z.string().min(1),
  outputScope: z.string().min(1).optional(),

  dependencies: z.array(z.string().min(1)).default([]),

  impact: z.array(z.string().min(1)).default([]),

  reversibilityClaim: z.array(z.string().min(1)).default([]),
});
export type RawProposal = z.infer<typeof RawProposalSchema>;
