// biome-ignore lint/style/useImportType: const used in `typeof` for type derivation
import { z } from "zod"

import type { PipelineStageFn } from "#/platform/pipeline/stage/stage.types"
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types"
import type { STAGE } from "./planning.const"
import type { PlanningSchema } from "./planning.schemas"

export type Planning = z.infer<typeof PlanningSchema>

export type PlanningErrorCode =
	| "PLANNING_PREREQ_MISSING"
	| "INVALID_PLANNING_INPUT"

export type PlanningStage = PipelineStageFn<
	IngestionPipelineEnvelope,
	typeof STAGE,
	PlanningErrorCode
>
