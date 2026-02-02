import z from "zod";

import { ActorSchema } from "./actors.schemas";
import { ACTOR_TYPES } from "./actors.const";

export type Actor = z.infer<typeof ActorSchema>;
export type ActorType = (typeof ACTOR_TYPES)[number];
