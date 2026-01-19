import { ContextSnapshot } from "#/types/domain/snapshot/snapshot.provider.types";

const validSnapshot = {
  permissions: { actor: "user_1", allow: ["WEEKLY_REFLECTION"] as const },
  invariantsVersion: "v1",
  scope: { allowedKinds: ["NOTE"] as const },
  timestampMs: 1234567890,
  dependencyVersions: {}, //  llm: "none"
} satisfies ContextSnapshot<"WEEKLY_REFLECTION", "NOTE">;

export function getContextSnapshot() {
  return validSnapshot;
}
