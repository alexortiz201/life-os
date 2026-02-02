import z from "zod";

import { ACTOR_TYPES } from "./actors.const";

export const ActorSchema = z.object({
  actorId: z.string().min(1),
  actorType: z.enum(ACTOR_TYPES),
  role: z.string().min(1).optional(),
});
