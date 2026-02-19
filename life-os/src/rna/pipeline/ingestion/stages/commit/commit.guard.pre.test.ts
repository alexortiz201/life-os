import { expect, test } from "vitest"
import { ENVELOPE_STAGE_TO_KEY } from "#/rna/envelope/envelope.const"

import { INGESTION_STAGE_DEPS } from "#/rna/pipeline/ingestion/ingestion.const"
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types"
import { guardPreCommit } from "#/rna/pipeline/ingestion/stages/commit/commit.guard"
import { makeEnv as makeEnvUtil, resetStagesUpTo } from "#/shared/test-utils"

const makeEnv = (patch?: any) => resetStagesUpTo("commit", makeEnvUtil(patch))

const STAGE = "COMMIT" as const
const CODE = "COMMIT_PREREQ_MISSING" as const

function lastError(env: IngestionPipelineEnvelope) {
	const errs = env.errors ?? []
	expect(
		errs.length > 0,
		"Expected env.errors to have at least 1 error."
	).toBeTruthy()
	return errs[errs.length - 1] as any
}

test("guardPreCommit passes when all dependencies are satisfied", () => {
	const env = makeEnv()
	const res = guardPreCommit(env)

	expect(res.ok).toBeTruthy()
})

test("guardPreCommit fails when any required dependency stage has not run", () => {
	const deps = INGESTION_STAGE_DEPS[STAGE]

	for (const depStage of deps.stages) {
		const stageKey = ENVELOPE_STAGE_TO_KEY[depStage]

		const env = makeEnv({
			stages: {
				[stageKey]: {
					...(makeEnv().stages as any)[stageKey],
					hasRun: false,
				},
			} as any,
		})

		const res = guardPreCommit(env)
		expect(res.ok).toBe(false)

		if (!res.ok) {
			const err = lastError(res.env)

			expect(err.stage).toBe(STAGE)
			expect(err.code).toBe(CODE)
			expect(err.severity).toBe("HALT")

			// message is: `${stageKey} stage has not run.`
			expect(err.message).toBe(`${stageKey} stage has not run.`)

			// trace includes proposalId + `${stageKey}HasRun`: false
			expect(err.trace?.proposalId).toBe(env.ids.proposalId)
			expect(err.trace?.[`${stageKey}HasRun`]).toBeFalsy()
		}
	}
})

test("guardPreCommit fails when any required dependency id is missing", () => {
	const deps = INGESTION_STAGE_DEPS[STAGE]

	for (const idKey of deps.ids) {
		const stageKey = ENVELOPE_STAGE_TO_KEY[STAGE]

		const env = makeEnv({
			ids: {
				[idKey]: "", // assertIdExists checks string length > 0
			} as any,
		})

		const res = guardPreCommit(env)

		expect(res.ok, `Expected fail when id ${String(idKey)} missing`).toBe(false)

		if (!res.ok) {
			const err = lastError(res.env)

			expect(err.stage).toBe(STAGE)
			expect(err.code).toBe(CODE)
			expect(err.severity).toBe("HALT")

			// message comes from assertIdExists call in assertStageDependencies
			expect(err.message).toBe(
				`Missing ${String(idKey)} required for ${stageKey}.`
			)

			// trace includes proposalId + idKey + value
			expect(err.trace?.proposalId).toBe(env.ids.proposalId)
			expect(err.trace?.idKey).toBe(idKey)
			expect(err.trace?.value).toBe("") // since we set empty string
		}
	}
})
