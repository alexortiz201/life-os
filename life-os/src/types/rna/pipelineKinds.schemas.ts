// src/domain/pipeline/pipelineKinds.schemas.ts
import { z } from "zod";
import {
  DEFAULT_PIPELINES,
  INGESTION_MEDIA_KINDS,
  PIPELINE_KINDS,
  PIPELINE_NAMES,
} from "./pipelineKinds.constants";

export const PipelineKindSchema = z.enum(PIPELINE_KINDS);
export type PipelineKind = z.infer<typeof PipelineKindSchema>;

export const PipelineNameSchema = z.enum(PIPELINE_NAMES);
export type PipelineName = z.infer<typeof PipelineNameSchema>;

export const IngestionMediaKindSchema = z.enum(INGESTION_MEDIA_KINDS);
export type IngestionMediaKind = z.infer<typeof IngestionMediaKindSchema>;

export const PipelineVersionSchema = z.string().min(1);

export const PipelineCatalogEntrySchema = z.object({
  name: PipelineNameSchema,
  version: PipelineVersionSchema,
  kind: PipelineKindSchema,
});
export type PipelineCatalogEntry = z.infer<typeof PipelineCatalogEntrySchema>;

export const PipelineCatalogSchema = z.array(PipelineCatalogEntrySchema);
export type PipelineCatalog = z.infer<typeof PipelineCatalogSchema>;

// Optional: runtime “assertion” that your DEFAULT_PIPELINES stay valid.
// This will throw at import-time if the constants drift.
export const DEFAULT_PIPELINES_VALIDATED =
  PipelineCatalogSchema.parse(DEFAULT_PIPELINES);
