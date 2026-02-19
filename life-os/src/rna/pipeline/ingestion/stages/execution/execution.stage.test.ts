import * as E from "fp-ts/Either"
import { expect, test } from "vitest"
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types"
import { executionStage } from "#/rna/pipeline/ingestion/stages/execution/execution.stage"
import {
	lastError,
	makeEnv as makeEnvUtil,
	resetStagesUpTo,
	unwrapLeft,
	unwrapRight,
} from "#/shared/test-utils"

const makeEnv = () => resetStagesUpTo("execution", makeEnvUtil())

test("does nothing when earlier HALT errors exist (fails closed)", () => {
	const env = makeEnv()
	env.errors.push({
		stage: "VALIDATION" as any,
		severity: "HALT",
		code: "SOME_HALTING_ERROR",
		message: "stop",
		at: Date.now(),
	})

	const out = executionStage(env)
	const nextEnv = unwrapRight(out)

	expect(nextEnv).toBe(env)
})

test("appends HALT error when planning stage has not run", () => {
	const env = makeEnv()
	;(env.stages.planning as any) = { hasRun: false }

	const out = executionStage(env)
	const left = unwrapLeft(out) as any

	const nextEnv = left.env as IngestionPipelineEnvelope

	expect(nextEnv.stages.execution.hasRun).toBeFalsy()
	expect(nextEnv.errors.length >= 1).toBeTruthy()

	const err = lastError(nextEnv) as any
	expect(err.stage).toBe("EXECUTION")
	expect(err.severity).toBe("HALT")
	expect(err.code).toBe("EXECUTION_PREREQ_MISSING")
})

test("appends HALT error when snapshotId is missing", () => {
	const env = makeEnv()
	env.ids.snapshotId = undefined

	const out = executionStage(env)
	const left = unwrapLeft(out) as any

	const nextEnv = left.env as IngestionPipelineEnvelope

	expect(nextEnv.stages.execution.hasRun).toBeFalsy()
	expect(nextEnv.errors.length >= 1).toBeTruthy()

	const err = lastError(nextEnv) as any
	expect(err.stage).toBe("EXECUTION")
	expect(err.severity).toBe("HALT")
	expect(err.code).toBe("EXECUTION_PREREQ_MISSING")
})

test("fails closed if execution input is invalid (guardExecution enforced)", () => {
	const env = makeEnv()

	// Corrupt a required identifier to force guardExecution to fail
	;(env.ids as any).proposalId = ""

	const out = executionStage(env)
	const left = unwrapLeft(out) as any

	const nextEnv = left.env as IngestionPipelineEnvelope

	expect(nextEnv.stages.execution.hasRun).toBeFalsy()
	expect(nextEnv.errors.length >= 1).toBeTruthy()

	const err = lastError(nextEnv) as any
	expect(err.stage).toBe("EXECUTION")
	expect(err.severity).toBe("HALT")
	expect(err.code).toBe("EXECUTION_PREREQ_MISSING")
})

test("writes execution stage output + ids when prereqs satisfied and guard passes", () => {
	const env = makeEnv()
	const out = executionStage(env)
	const nextEnv = unwrapRight(out)

	expect(nextEnv.errors.length).toBe(0)
	expect(nextEnv.stages.execution.hasRun).toBeTruthy()

	// ids written (shape expectation, not exact value)
	expect(nextEnv.ids.executionId).toBeTruthy()
	expect(nextEnv.ids.executionId).toBeTypeOf("string")
	expect(nextEnv.ids.executionId).toMatch(/^.+$/)

	expect(nextEnv.ids.effectsLogId).toBeTruthy()
	expect(nextEnv.ids.effectsLogId).toBeTypeOf("string")
	expect(nextEnv.ids.effectsLogId).toMatch(/^.+$/)

	const x = nextEnv.stages.execution as any

	// stage writeback
	expect(typeof x.ranAt).toBe("number")
	expect(x.executionId).toBe(nextEnv.ids.executionId)

	// observed invariants (audit wiring)
	expect(x.observed).toBeTruthy()
	expect(x.observed.proposalId).toBe(nextEnv.ids.proposalId)
	expect(x.observed.snapshotId).toBe(nextEnv.ids.snapshotId)
	expect(x.observed.planningId).toBe(nextEnv.ids.planningId)

	// effects log invariants (must exist even if empty)
	expect(x.effectsLog).toBeTruthy()
	expect(x.effectsLog.effectsLogId).toBe(nextEnv.ids.effectsLogId)
	expect(x.effectsLog.proposalId).toBe(nextEnv.ids.proposalId)
	expect(x.effectsLog.producedEffects).toSatisfy(Array.isArray)

	for (const e of x.effectsLog.producedEffects) {
		expect((e as any).trust).not.toBe("COMMITTED")
	}
})

test("effectsLog.proposalId matches envelope proposalId (drift prevention baseline)", () => {
	const env = makeEnv()
	const out = executionStage(env)
	const nextEnv = unwrapRight(out)

	const x = nextEnv.stages.execution as any
	expect(x.effectsLog.proposalId).toBe(nextEnv.ids.proposalId)
})
