import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";
import {
  EnvelopeStage,
  StageErrorSeverity,
} from "#/rna/envelope/envelope.types";

export function hasHaltingErrors(
  env: IngestionPipelineEnvelope,
  opts?: { upToStage?: EnvelopeStage }
): boolean {
  // If you later want "upToStage", you can implement ordering.
  // For now, simplest: any HALT anywhere stops forward progress.
  return env.errors.some((e) => e.severity === "HALT");
}

export function appendError(
  env: IngestionPipelineEnvelope,
  error: {
    stage: EnvelopeStage;
    severity: StageErrorSeverity;
    code: string;
    message: string;
    trace?: unknown;
    at?: number;
  }
): IngestionPipelineEnvelope {
  const at = error.at ?? Date.now();
  return {
    ...env,
    errors: [
      ...env.errors,
      {
        ...error,
        at,
      },
    ],
  };
}
