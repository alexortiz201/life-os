import { z } from "zod";
import { TrustLevelSchema } from "./trust";
import { IdSchema } from "./ids";
import { ACTOR_TYPES } from "./constants";

export const IsoTimestampSchema = z.string().datetime();
export type IsoTimestamp = z.infer<typeof IsoTimestampSchema>;

export const ActorSchema = z.object({
  actorId: z.string().min(1),
  actorType: z.enum(ACTOR_TYPES),
  role: z.string().min(1).optional(),
});
export type Actor = z.infer<typeof ActorSchema>;

export const ArtifactBaseSchema = z.object({
  id: IdSchema,
  kind: z.string().min(1),
  trust: TrustLevelSchema,
  createdAt: IsoTimestampSchema,
  actor: ActorSchema,
});
export type ArtifactBase = z.infer<typeof ArtifactBaseSchema>;
