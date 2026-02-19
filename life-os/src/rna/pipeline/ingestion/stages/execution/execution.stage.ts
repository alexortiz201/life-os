// execution.stage.ts

import * as E from "fp-ts/Either"
import { pipe } from "fp-ts/function"
import type { Effect } from "#/domain/effects/effects.types"
import { fingerprint } from "#/domain/encoding/fingerprint"
import { getNewId } from "#/domain/identity/id.provider"
import {
	leftFromLastError,
	makeStageLeft,
} from "#/platform/pipeline/stage/stage"
import { appendError, hasHaltingErrors } from "#/rna/envelope/envelope-utils"
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types"
import { STAGE } from "./execution.const"
import { guardExecution, guardPreExecution } from "./execution.guard"
import type { ExecutionErrorCode, ExecutionStage } from "./execution.types"

const left = makeStageLeft<IngestionPipelineEnvelope>(appendError)

export const executionStage: ExecutionStage = (env) => {
	// 0) fail closed if earlier stage produced HALT errors
	if (hasHaltingErrors(env)) return E.right(env)

	return pipe(
		E.right(env),

		// 1) prereqs (stage-level, before guard)
		E.chain((env) => {
			const pre = guardPreExecution(env as any)

			return pre.ok
				? E.right(pre.env)
				: leftFromLastError<
						IngestionPipelineEnvelope,
						typeof STAGE,
						ExecutionErrorCode
					>(pre.env)
		}),

		// 2) run guard (schema / contract)
		E.chain((env) => {
			const g = guardExecution(env)

			if (g.ok) return E.right(env)

			const nextEnv = appendError(env, {
				stage: STAGE,
				severity: "HALT",
				code: g.code,
				message: g.message,
				trace: g.trace,
				at: Date.now(),
			})

			return left({
				env: nextEnv,
				stage: STAGE,
				code: g.code as ExecutionErrorCode,
				message: g.message,
				trace: g.trace,
			})
		}),

		// 3) write stage output back into envelope
		E.map((env) => {
			const ranAt = Date.now()
			const executionId = getNewId("execution")
			const effectsLogId = getNewId("effects")
			const producedEffects: Effect[] = []
			const execution = {
				hasRun: true,
				ranAt,
				observed: {
					proposalId: env.ids.proposalId,
					snapshotId: env.ids.snapshotId,
					planningId: env.ids.planningId,
				},
				executionId,
				effectsLog: {
					effectsLogId,
					proposalId: env.ids.proposalId,
					producedEffects,
					fingerprint: fingerprint({
						proposalId: env.ids.proposalId,
						effectsLogId,
						producedEffects,
					}),
				},
			} satisfies IngestionPipelineEnvelope["stages"]["execution"]

			return {
				...env,
				ids: { ...env.ids, executionId, effectsLogId },
				stages: { ...env.stages, execution },
			}
		})
	)
}
