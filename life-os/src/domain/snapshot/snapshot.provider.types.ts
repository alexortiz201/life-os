import type { z } from "zod"

import type { PermissionState } from "#/domain/permissions/permissions.types"
import type { ScopeConfig } from "#/domain/scopes/scopes.types"

// biome-ignore lint/style/useImportType: schemas used in `typeof` for type derivation
import { IngestionContextSnapshotSchema } from "./snapshot.provider.schemas"

export type ContextSnapshot<
	TAllowActions extends string,
	TAllowKind extends string,
> = {
	permissions: PermissionState<TAllowActions>
	scope: ScopeConfig<TAllowKind>
	invariantsVersion: string
	timestampMs: number
	dependencyVersions?: Readonly<Record<string, string>>
}

export type Snapshot = z.infer<typeof IngestionContextSnapshotSchema>
