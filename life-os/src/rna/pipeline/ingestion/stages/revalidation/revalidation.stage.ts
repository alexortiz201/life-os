import * as E from "fp-ts/Either"
import { pipe } from "fp-ts/function"

import { getNewId } from "#/domain/identity/id.provider"
import {
	leftFromLastError,
	makeStageLeft,
} from "#/platform/pipeline/stage/stage"

import { appendError, hasHaltingErrors } from "#/rna/envelope/envelope-utils"
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types"
import { STAGE } from "./revalidation.const"
import {
	guardPreRevalidation,
	guardRevalidation,
	postGuardRevalidation,
} from "./revalidation.guard"
import type {
	RevalidationErrorCode,
	RevalidationStage,
} from "./revalidation.types"

const left = makeStageLeft<IngestionPipelineEnvelope>(appendError)

export const revalidationStage: RevalidationStage = (env) => {
	// 0) fail closed if earlier stage produced HALT errors
	if (hasHaltingErrors(env)) return E.right(env)

	return pipe(
		E.right(env),

		// 1) prereqs
		E.chain((env) => {
			const pre = guardPreRevalidation(env as any)

			return pre.ok
				? E.right(pre.env)
				: leftFromLastError<
						IngestionPipelineEnvelope,
						typeof STAGE,
						RevalidationErrorCode
					>(pre.env)
		}),

		// 2) guard (schema/contract)
		E.chain((env) => {
			const g = guardRevalidation(env)

			if (g.ok) return E.right({ env, data: g.data })

			return left({
				env,
				stage: STAGE,
				code: g.code as RevalidationErrorCode,
				message: g.message,
				trace: g.trace,
			})
		}),

		// 3) post-guard (stage-specific semantic rules)
		E.chain(({ env, data }) => {
			const g = postGuardRevalidation({ env, data }) // <- feed both

			return g.ok
				? E.right({ env, data: g.data }) // often you return refined data
				: left({
						env,
						stage: STAGE,
						code: g.code as RevalidationErrorCode,
						message: g.message,
						trace: g.trace,
					})
		}),

		// 4) write stage output
		E.map(({ env, data }) => {
			const ranAt = Date.now()
			const revalidationId = getNewId("revalidation")

			const observed = {
				snapshotId: env.ids.snapshotId,
				proposalId: env.ids.proposalId,
				intakeId: env.ids.intakeId,
				validationId: env.ids.validationId,
				planningId: env.ids.planningId,
				effectsLogId: env.ids.effectsLogId,
			}
			const revalidation = {
				hasRun: true,
				ranAt,
				observed,
				revalidationId,
				...data,
			} satisfies IngestionPipelineEnvelope["stages"]["revalidation"]

			return {
				...env,
				ids: { ...env.ids, revalidationId },
				stages: { ...env.stages, revalidation },
			}
		})
	)
}
