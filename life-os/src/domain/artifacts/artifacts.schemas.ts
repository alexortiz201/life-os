import z from "zod"
import { ActorSchema } from "#/domain/actors/actors.schemas"
import { TrustLevelSchema } from "#/domain/trust/trust.schemas"

export const IsoTimestampSchema = z.iso.datetime()
export const ArtifactBaseSchema = z.object({
	id: z.string().min(1),
	kind: z.string().min(1),
	trust: TrustLevelSchema,
	createdAt: IsoTimestampSchema,
	actor: ActorSchema,
})
