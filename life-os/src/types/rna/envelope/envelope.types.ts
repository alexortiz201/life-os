import { PipelineStage } from "#/rna/pipeline/pipeline.types";

export type StageErrorSeverity = "HALT" | "WARN";
export type EnvelopeStage = PipelineStage | "ENVELOPE";
