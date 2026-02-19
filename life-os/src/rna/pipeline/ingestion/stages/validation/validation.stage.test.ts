import { expect, test } from "vitest"
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types"
import { validationStage } from "#/rna/pipeline/ingestion/stages/validation/validation.stage"
import {
	clone,
	lastError,
	makeEnv,
	resetStagesUpTo,
	unwrapLeft,
	unwrapRight,
} from "#/shared/test-utils"

const makeValidationEnv = () => resetStagesUpTo("validation", makeEnv())

test("appends HALT error when proposalId missing (fail closed)", () => {
	const env = makeValidationEnv()
	;(env.ids.proposalId as any) = ""

	const out = validationStage(env)
	const left = unwrapLeft(out)

	expect(left.env.stages.validation.hasRun).toBeFalsy()
	expect(left.env.errors.length >= 1).toBeTruthy()

	const err = lastError(left.env) as any
	expect(err.stage).toBe("VALIDATION")
	expect(err.severity).toBe("HALT")
	expect(err.code).toBe("VALIDATION_PREREQ_MISSING")
})

test("appends HALT error when snapshotId missing (context snapshot required)", () => {
	const env = makeValidationEnv()
	delete (env.ids as any).snapshotId

	const out = validationStage(env)
	const left = unwrapLeft(out)

	expect(left.env.stages.validation.hasRun).toBeFalsy()
	expect(left.env.errors.length >= 1).toBeTruthy()

	const err = lastError(left.env) as any
	expect(err.stage).toBe("VALIDATION")
	expect(err.severity).toBe("HALT")
	expect(err.code).toBe("VALIDATION_PREREQ_MISSING")
})

test("writes a deterministic, untrusted decision artifact and does not create downstream artifacts", () => {
	const env = makeValidationEnv()

	const out = validationStage(env)
	const nextEnv = unwrapRight(out)

	expect(nextEnv.errors.length).toBe(0)
	expect(nextEnv.stages.validation.hasRun).toBeTruthy()

	// must write validationId
	expect(nextEnv.ids.validationId).toBeTruthy()
	expect(nextEnv.ids.validationId).toBeTypeOf("string")
	expect(nextEnv.ids.validationId).toMatch(/^.+$/)

	const v = nextEnv.stages.validation as any

	// contract: explicit decision artifact
	expect(v.validationId).toBe(nextEnv.ids.validationId)
	expect(v.observed.proposalId).toBe(nextEnv.ids.proposalId)

	// decision_type must be one of the allowed outcomes
	expect(["APPROVE", "REJECT", "PARTIAL_APPROVE", "ESCALATE"]).toContain(
		v.decisionType
	)

	// must include explainability / attribution / timestamp fields
	expect(typeof v.decidedAt).toBe("number")
	expect(v.justification).toBeTruthy()
	expect(v.attribution).toBeTruthy()

	// trust model: decision must not be COMMITTED (if present)
	if (typeof v.trust === "string") {
		expect(v.trust).not.toBe("COMMITTED")
	}

	// forbidden side effects: must not create planning output
	expect((nextEnv.stages.planning as any)?.hasRun).toBeFalsy()
	expect(nextEnv.ids.planningId).toBeUndefined()

	// forbidden side effects: must not create execution output/effects
	expect((nextEnv.stages.execution as any)?.hasRun).toBeFalsy()
	expect(nextEnv.ids.executionId).toBeUndefined()
	expect(nextEnv.ids.effectsLogId).toBeUndefined()
	expect((nextEnv.stages.execution as any)?.effectsLog).toBeUndefined()
})

test("no permissions allowed => HALT with SNAPSHOT_PERMISSION_NOT_ALLOWED and no advancement", () => {
	const env = makeValidationEnv()

	// force the rule: permissions.allow must be non-empty
	;(env as any).snapshot = {
		permissions: {
			actor: { actorId: "user_1", actorType: "USER" },
			allow: [] as const,
		},
		invariantsVersion: "v1",
		scope: { allowedKinds: [] },
		timestamp: 1234567890,
	}

	const out = validationStage(env)
	const left = unwrapLeft(out)

	expect(left.env.errors.length >= 1).toBeTruthy()

	const err = lastError(left.env) as any
	expect(err.stage).toBe("VALIDATION")
	expect(err.severity).toBe("HALT")
	expect(err.code).toBe("SNAPSHOT_PERMISSION_NOT_ALLOWED")

	// must not advance to planning
	expect((left.env.stages.planning as any)?.hasRun).toBeFalsy()
	expect(left.env.ids.planningId).toBeUndefined()
})

test("validation is deterministic for identical inputs (decision + constraints match)", () => {
	const env1 = makeValidationEnv()
	const env2 = clone(env1)

	;(env2 as any).snapshot = clone((env1 as any).snapshot)

	const out1 = validationStage(env1)
	const out2 = validationStage(env2)

	const next1 = unwrapRight(out1)
	const next2 = unwrapRight(out2)

	expect(next1.errors.length).toBe(0)
	expect(next2.errors.length).toBe(0)

	const v1 = next1.stages.validation as any
	const v2 = next2.stages.validation as any

	expect(v1.decisionType).toBe(v2.decisionType)

	// if partial, constraints must match as well
	if (v1.decisionType === "PARTIAL_APPROVE") {
		expect(v1.constraints).toEqual(v2.constraints)
	}

	// must not affect downstream stages
	expect((next1.stages.planning as any)?.hasRun).toBeFalsy()
	expect((next2.stages.planning as any)?.hasRun).toBeFalsy()
})

test("validation does not mutate other stages or ids (safe to repeat)", () => {
	const env = makeValidationEnv()
	const beforePlanning = clone(env.stages.planning as any)
	const beforeIds = clone(env.ids)

	const out = validationStage(env)

	// depending on env.snapshot.permissions.allow, this might be Left or Right
	const nextEnv = ((): IngestionPipelineEnvelope => {
		try {
			return unwrapRight(out)
		} catch {
			return unwrapLeft(out).env
		}
	})()

	// regardless of outcome, validation must not write planning/execution ids
	expect(nextEnv.stages.planning as any).toEqual(beforePlanning)
	expect(nextEnv.ids.planningId).toBe(beforeIds.planningId)
	expect(nextEnv.ids.executionId).toBe(beforeIds.executionId)
	expect(nextEnv.ids.effectsLogId).toBe(beforeIds.effectsLogId)
})
