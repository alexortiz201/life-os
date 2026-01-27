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

export type HasErrors<TErr> = { errors: TErr[] };

type Error = {
  stage: EnvelopeStage;
  severity: StageErrorSeverity;
  code: string;
  message: string;
  trace?: unknown;
  at?: number;
};

export function appendError<TErr extends Error, TEnv extends HasErrors<TErr>>(
  env: TEnv,
  error: Omit<TErr, "at"> & { at?: number }
): TEnv {
  const at = error.at ?? Date.now();
  const nextErr = { ...error, at } as TErr;

  return {
    ...env,
    errors: [...env.errors, nextErr],
  };
}
