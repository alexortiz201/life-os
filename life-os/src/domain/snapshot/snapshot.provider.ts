import { IngestionContextSnapshot } from "#/rna/pipeline/ingestion/ingestion.types";

export function getContextSnapshot(env: any): IngestionContextSnapshot {
  const validIngestionSnapshot = {
    permissions: {
      actor: { actorId: "user_1", actorType: "USER" },
      allow: ["WEEKLY_REFLECTION"] as const,
    },
    invariantsVersion: "v1",
    scope: { allowedKinds: ["NOTE"] as const },
    timestampMs: 1234567890,
    dependencyVersions: {}, //  llm: "none"
  } satisfies IngestionContextSnapshot;
  return validIngestionSnapshot;
}
