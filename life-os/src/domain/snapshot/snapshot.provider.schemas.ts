import { z } from "zod"

import { KINDS } from "#/domain/scopes/scopes.const"
import { PermissionSchema } from "#/rna/pipeline/ingestion/ingestion.schemas"

export const IngestionContextSnapshotSchema = z.object({
	snapshotId: z.string().min(1),
	permissions: PermissionSchema,
	scope: z.object({
		allowedKinds: z.array(z.literal(KINDS)).readonly(),
	}),
	invariantsVersion: z.string().min(1),
	timestampMs: z.number().int().nonnegative(),
	dependencyVersions: z.record(z.string(), z.string()).optional(),
})
