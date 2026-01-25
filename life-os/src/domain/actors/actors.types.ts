import z from "zod";

import { ActorSchema } from "./actors.schemas";

export type Actor = z.infer<typeof ActorSchema>;
