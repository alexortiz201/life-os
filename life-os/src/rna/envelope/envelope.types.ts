import { PipelineStage } from "#/platform/pipeline/pipeline.types";

export type StageErrorSeverity = "HALT" | "WARN";
export type EnvelopeStage = PipelineStage | "ENVELOPE";
