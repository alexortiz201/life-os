type PermissionsState<TAllowPerm extends string> = {
  actor: string;
  allow: readonly TAllowPerm[];
};
type ScopeConfig<TAllowKind extends string> = {
  allowedKinds: readonly TAllowKind[];
};

export type ContextSnapshot<
  TAllowPerm extends string,
  TAllowKind extends string
> = {
  permissions: PermissionsState<TAllowPerm>;
  scope: ScopeConfig<TAllowKind>;
  invariantsVersion: string;
  timestampMs: number;
  dependencyVersions?: Readonly<Record<string, string>>;
};
