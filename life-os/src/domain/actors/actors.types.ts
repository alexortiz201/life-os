// biome-ignore lint/style/useImportType: const used in `typeof` for type derivation
import z from "zod"
import type { ACTOR_TYPES } from "./actors.const"
import type { ActorSchema } from "./actors.schemas"

export type Actor = z.infer<typeof ActorSchema>
export type ActorType = (typeof ACTOR_TYPES)[number]
