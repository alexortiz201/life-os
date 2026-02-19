import { expect, test } from "vitest"
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types"
import {
	guardPlanning,
	guardPrePlanning,
} from "#/rna/pipeline/ingestion/stages/planning/planning.guard"

import { makeEnv } from "#/shared/test-utils"

test("returns ok:false INVALID_PLANNING_INPUT when input shape is wrong", () => {
	const result = guardPlanning({ nope: true } as any)

	expect(result.ok).toBeFalsy()
	if (!result.ok) {
		expect(result.code).toBe("INVALID_PLANNING_INPUT")
		expect(typeof result.message).toBe("string")
		expect(result.trace).toBeTruthy()
		expect(result.trace.mode).toBe("UNKNOWN")
		expect(result.trace.rulesApplied).toBeInstanceOf(Array)
		expect(result.trace.rulesApplied).toContain("PARSE_FAILED")
	}
})

test("guardPlanning does not append envelope errors or mutate env (pure parse guard)", () => {
	const env = makeEnv()
	const beforeErrorsLen = env.errors.length
	const beforePlanningHasRun = (env.stages.planning as any)?.hasRun
	const beforePlanningId = env.ids.planningId

	// Force failure by breaking the input in a way the schema should reject
	env.ids.proposalId = "" as any

	const result = guardPlanning(env as any)

	expect(result.ok).toBeFalsy()

	// 🔒 guard is pure: must not mutate env
	expect(env.errors.length).toBe(beforeErrorsLen)
	expect((env.stages.planning as any)?.hasRun).toBe(beforePlanningHasRun)
	expect(env.ids.planningId).toBe(beforePlanningId)
})

test("guardPlanning does not enforce prereqs via side-effects (missing snapshotId does not append errors)", () => {
	const env = makeEnv()
	const beforeErrorsLen = env.errors.length

	// Missing input field that the schema should require
	env.ids.snapshotId = undefined

	const result = guardPlanning(env as any)

	// The key assertion: it must not append errors to env.
	expect(env.errors.length).toBe(beforeErrorsLen)

	// If it fails, it should be a parse/shape failure code
	if (!result.ok) {
		expect(result.code).toBe("INVALID_PLANNING_INPUT")
		expect(result.trace.rulesApplied).toContain("PARSE_FAILED")
	}
})

test("returns ok:true with parsed planning input when deps satisfied + schema passes", () => {
	const env = makeEnv()

	// prereqs that guardFactory narrowing + schema likely require
	env.ids.snapshotId = env.ids.snapshotId ?? "snapshot_1"

	// ✅ guardPrePlanning likely requires validation.hasRun === true and validationId exists
	;(env.stages.validation as any) = {
		...(env.stages.validation as any),
		hasRun: true,
		validationId: env.ids.validationId ?? "validation_1",
		// ✅ pluckParams passes commitPolicy through; schema may require it
		commitPolicy: { allowedModes: ["FULL", "PARTIAL"] as const },
	}

	const result = guardPlanning(env as any)

	expect(result.ok).toBeTruthy()
	if (result.ok) {
		// plucked inputs
		expect(result.data.proposalId).toBe(env.ids.proposalId)
		expect(result.data.snapshotId).toBe(env.ids.snapshotId)

		// NOTE: pluckParams currently sets this from validation.validationId
		expect(result.data.validationDecision).toBe(
			(env.stages.validation as any).validationId
		)

		// planningId is not created yet at planning time, so pluck defaults it
		expect(result.data.planningId).toBe(
			env.ids.planningId ?? "planning_unknown"
		)

		// plan is currently plucked from stages.validation (bug/placeholder),
		// so it should fall back to [].
		expect(Array.isArray(result.data.plan)).toBe(true)
		expect(result.data.plan).toEqual([])

		// commitPolicy should be present if schema requires it
		expect(result.data.commitPolicy).toBeTruthy()
	}
})

test("returns ok:false INVALID_PLANNING_INPUT when schema parse fails (fail closed, no env mutation)", () => {
	const env = makeEnv()
	const beforeErrorsLen = env.errors.length

	// satisfy dependency presence
	;(env.stages.validation as any) = {
		...(env.stages.validation as any),
		hasRun: true,
		validationId: env.ids.validationId ?? "validation_1",
		commitPolicy: { allowedModes: ["FULL", "PARTIAL"] as const },
	}

	// make schema fail: snapshotId undefined is a clean way to break a required string
	env.ids.snapshotId = undefined

	const result = guardPlanning(env as any)

	expect(result.ok).toBeFalsy()
	if (!result.ok) {
		expect(result.code).toBe("INVALID_PLANNING_INPUT")
		expect(result.trace.mode).toBe("UNKNOWN")
		expect(result.trace.rulesApplied).toContain("PARSE_FAILED")
	}

	// 🔒 guard is pure: must not append errors
	expect(env.errors.length).toBe(beforeErrorsLen)
})

///////////// GuardPrePlanning
function lastError(env: IngestionPipelineEnvelope) {
	return env.errors[env.errors.length - 1]
}

test("appends HALT PLANNING_PREREQ_MISSING when required prior stage has not run (VALIDATION)", () => {
	const env = makeEnv()

	;(env.stages.validation as any) = {
		...(env.stages.validation as any),
		hasRun: false,
	}

	const result = guardPrePlanning(env)

	expect(result.ok).toBeFalsy()
	if (!result.ok) {
		expect(result.env.errors.length >= 1).toBeTruthy()
		const err = lastError(result.env) as any

		expect(err.stage).toBe("PLANNING")
		expect(err.severity).toBe("HALT")
		expect(err.code).toBe("PLANNING_PREREQ_MISSING")
	}
})

test("appends HALT PLANNING_PREREQ_MISSING when required ids are missing (validationId)", () => {
	const env = makeEnv()

	// planning deps require validationId per your dependency logic
	env.ids.validationId = undefined

	const result = guardPrePlanning(env)

	expect(result.ok).toBeFalsy()
	if (!result.ok) {
		const err = lastError(result.env) as any

		expect(err.stage).toBe("PLANNING")
		expect(err.severity).toBe("HALT")
		expect(err.code).toBe("PLANNING_PREREQ_MISSING")

		expect(err.trace?.proposalId).toBe(env.ids.proposalId)
		expect(err.trace?.idKey).toBe("validationId")
		expect(err.trace?.value).toBeUndefined()
	}
})

test("appends HALT PLANNING_PREREQ_MISSING when required ids are missing (snapshotId)", () => {
	const env = makeEnv()

	env.ids.snapshotId = undefined

	const result = guardPrePlanning(env)

	expect(result.ok).toBeFalsy()
	if (!result.ok) {
		const err = lastError(result.env) as any

		expect(err.stage).toBe("PLANNING")
		expect(err.severity).toBe("HALT")
		expect(err.code).toBe("PLANNING_PREREQ_MISSING")

		expect(err.trace?.proposalId).toBe(env.ids.proposalId)
		expect(err.trace?.idKey).toBe("snapshotId")
		expect(err.trace?.value).toBeUndefined()
	}
})

test("returns ok:true when dependencies are satisfied (VALIDATION hasRun + ids present)", () => {
	const env = makeEnv()

	;(env.stages.validation as any) = {
		...(env.stages.validation as any),
		hasRun: true,
	}

	env.ids.validationId = env.ids.validationId ?? "validation_1"
	env.ids.snapshotId = env.ids.snapshotId ?? "snapshot_1"

	const result = guardPrePlanning(env)

	expect(result.ok).toBeTruthy()
	if (result.ok) {
		expect(result.env).toEqual(env)
		expect(result.env.errors.length).toBe(env.errors.length)
	}
})

test("fail-closed: does not mark planning as run and does not create planningId on prereq failure", () => {
	const env = makeEnv()

	;(env.stages.validation as any) = {
		...(env.stages.validation as any),
		hasRun: false,
	}

	const result = guardPrePlanning(env)

	expect(result.ok).toBeFalsy()
	if (!result.ok) {
		expect((result.env.stages.planning as any)?.hasRun).toBe(
			(env.stages.planning as any)?.hasRun
		)
		expect(result.env.ids.planningId).toBe(env.ids.planningId)
	}
})
