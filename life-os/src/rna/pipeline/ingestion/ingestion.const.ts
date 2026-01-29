import { PipelineStage } from "#/platform/pipeline/pipeline.types";
import type { EnvelopeIds } from "#/rna/pipeline/ingestion/ingestion.types";

export const INGESTION_STAGE_DEPS = {
  INTAKE: { stages: [], ids: [] },
  VALIDATION: {
    stages: ["INTAKE"],
    ids: ["proposalId", "snapshotId", "intakeId"],
  },
  PLANNING: {
    stages: ["VALIDATION"],
    ids: ["proposalId", "validationId", "snapshotId"],
  },
  EXECUTION: {
    stages: ["PLANNING"],
    ids: ["proposalId", "planningId", "snapshotId"],
  },
  REVALIDATION: {
    stages: ["EXECUTION", "VALIDATION"],
    ids: ["proposalId", "effectsLogId", "snapshotId"],
  },
  COMMIT: { stages: ["REVALIDATION"], ids: ["proposalId"] },
} as const satisfies Record<
  PipelineStage,
  { stages: readonly PipelineStage[]; ids: readonly (keyof EnvelopeIds)[] }
>;
