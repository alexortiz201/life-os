export const PIPELINE_KINDS = ["EXECUTION", "INGESTION", "DERIVATION"] as const;
export type PipelineKind = (typeof PIPELINE_KINDS)[number];

export const PIPELINE_NAMES = [
  "RNA_EXECUTION_PIPELINE",
  "DEFAULT_INGESTION_PIPELINE",
] as const;
export type PipelineName = (typeof PIPELINE_NAMES)[number];

// This is intentionally minimal.
// Later we can move the full “catalog objects” into schemas + runtime validation.
export const DEFAULT_PIPELINES = [
  {
    name: "RNA_EXECUTION_PIPELINE",
    version: "V1",
    kind: "EXECUTION",
  },
  {
    name: "DEFAULT_INGESTION_PIPELINE",
    version: "V1",
    kind: "INGESTION",
  },
] as const;

export const INGESTION_MEDIA_KINDS = [
  "TEXT",
  "AUDIO",
  "IMAGE",
  "VIDEO",
] as const;
export type IngestionMediaKind = (typeof INGESTION_MEDIA_KINDS)[number];
