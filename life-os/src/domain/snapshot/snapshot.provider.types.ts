import z from "zod";

import { PermissionState } from "#/domain/permissions/permissions.types";
import { ScopeConfig } from "#/domain/scopes/scopes.types";

import { IngestionContextSnapshotSchema } from "./snapshot.provider.schemas";

export type ContextSnapshot<
  TAllowPerm extends string,
  TAllowKind extends string,
> = {
  permissions: PermissionState<TAllowPerm>;
  scope: ScopeConfig<TAllowKind>;
  invariantsVersion: string;
  timestampMs: number;
  dependencyVersions?: Readonly<Record<string, string>>;
};

export type Snapshot = z.infer<typeof IngestionContextSnapshotSchema>;
