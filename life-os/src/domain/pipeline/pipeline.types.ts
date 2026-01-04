import type { PIPELINE_STAGES } from "./pipeline.constants";

export type PipelineStage = (typeof PIPELINE_STAGES)[number];
