import type * as E from "fp-ts/Either"
import type { PipelineStageError } from "#/platform/pipeline/pipeline.types"
import type {
	PipelineStageErrorSeverity,
	PipelineStageName,
} from "#/rna/pipeline/ingestion/ingestion.types"

export type StageLeft<
	TEnv,
	TStage extends PipelineStageName = PipelineStageName,
	TCode extends string = string,
> = {
	env: TEnv
	error: PipelineStageError<TStage, PipelineStageErrorSeverity, TCode>
}

export type PipelineStageFn<
	TEnvIn,
	TStage extends PipelineStageName,
	TCode extends string,
	TEnvOut = TEnvIn,
> = (env: TEnvIn) => E.Either<StageLeft<TEnvOut, TStage, TCode>, TEnvOut>

export type StageLeftHalt<
	TEnv,
	TStage extends PipelineStageName,
	TCode extends string,
> = {
	env: TEnv
	error: PipelineStageError<TStage, "HALT", TCode>
}
