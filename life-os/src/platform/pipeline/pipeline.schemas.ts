import { z } from "zod"
import { COMMIT_OUTCOMES } from "#/rna/pipeline/ingestion/stages/commit/commit.const"
import { PIPELINE_STAGES } from "./pipeline.constants"

export const PipelineStageSchema = z.enum(PIPELINE_STAGES)
export const EffectDecisionModeSchema = z.enum(["FULL", "PARTIAL"])
export const EffectDecisionModeOrUnknownSchema = z.enum([
	"FULL",
	"PARTIAL",
	"UNKNOWN",
])
export const CommitOutcomeSchema = z.enum(COMMIT_OUTCOMES)
