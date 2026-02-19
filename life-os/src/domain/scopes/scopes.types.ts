// biome-ignore lint/style/useImportType: const used in `typeof` for type derivation
import { KINDS } from "./scopes.const";

export type Kinds = (typeof KINDS)[number];

export type ScopeConfig<TKind extends string> = {
  allowedKinds: readonly TKind[];
};
