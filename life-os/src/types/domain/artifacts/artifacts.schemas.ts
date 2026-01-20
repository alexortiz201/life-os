import z from "zod";

import { TrustLevelSchema } from "#/types/domain/trust/trust.schemas";
import { ActorSchema } from "#/types/domain/actors/actors.schemas";

export const IsoTimestampSchema = z.iso.datetime();
export const ArtifactBaseSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  trust: TrustLevelSchema,
  createdAt: IsoTimestampSchema,
  actor: ActorSchema,
});
