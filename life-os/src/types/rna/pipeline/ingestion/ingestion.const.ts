import { PipelineStage } from "../pipeline.types";
import { EnvelopeIds } from "./ingestion.types";

export const INGESTION_STAGE_DEPS = {
  INTAKE: { stages: [], ids: ["proposalId"] },
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
