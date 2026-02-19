import type { PipelineStage } from "#/platform/pipeline/pipeline.types"
import type { EnvelopeStage } from "#/rna/envelope/envelope.types"
import type { IngestionStages } from "#/rna/pipeline/ingestion/ingestion.types"

export const KEY_TO_ENVELOPE_STAGE: Record<
	keyof IngestionStages,
	EnvelopeStage
> = {
	intake: "INTAKE",
	validation: "VALIDATION",
	planning: "PLANNING",
	execution: "EXECUTION",
	revalidation: "REVALIDATION",
	commit: "COMMIT",
} as const

export const ENVELOPE_STAGE_TO_KEY: Record<
	PipelineStage,
	keyof IngestionStages
> = {
	INTAKE: "intake",
	VALIDATION: "validation",
	PLANNING: "planning",
	EXECUTION: "execution",
	REVALIDATION: "revalidation",
	COMMIT: "commit",
} as const
