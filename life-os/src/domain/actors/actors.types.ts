// biome-ignore lint/style/useImportType: const used in `typeof` for type derivation
import z from "zod";

import { ActorSchema } from "./actors.schemas";
import { ACTOR_TYPES } from "./actors.const";

export type Actor = z.infer<typeof ActorSchema>;
export type ActorType = (typeof ACTOR_TYPES)[number];
