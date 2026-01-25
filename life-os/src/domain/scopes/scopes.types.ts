import { KINDS } from "./scopes.const";

export type Kinds = (typeof KINDS)[number];

export type ScopeConfig<TKind extends string> = {
  allowedKinds: readonly TKind[];
};
