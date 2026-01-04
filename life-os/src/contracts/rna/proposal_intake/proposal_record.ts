import { z } from "zod";
import {
  ArtifactBaseSchema,
  IsoTimestampSchema,
} from "../artifacts/artifact_base";
import { ProposalIdSchema } from "../artifacts/ids";
import { RawProposalSchema } from "./raw_proposal";

export const ProposalRecordSchema = ArtifactBaseSchema.extend({
  kind: z.literal("PROPOSAL_RECORD"),
  trust: z.literal("UNTRUSTED"),

  proposalId: ProposalIdSchema,
  normalized: RawProposalSchema,
  fingerprint: z.string().min(1),
  intakeTimestamp: IsoTimestampSchema,
  rawPayload: z.unknown(),
});
export type ProposalRecord = z.infer<typeof ProposalRecordSchema>;
