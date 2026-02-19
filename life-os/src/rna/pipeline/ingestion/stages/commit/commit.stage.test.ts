import { expect, test } from "vitest"
import { PIPELINE_NAME } from "#/rna/pipeline/ingestion/ingestion.const"
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types"
import {
	assertMatchId,
	lastError,
	makeEnv,
	makeValidEffectsLog,
	resetStagesUpTo,
	unwrapLeft,
	unwrapRight,
} from "#/shared/test-utils"
import { commitStage } from "./commit.stage"

function getCommitRecord(env: IngestionPipelineEnvelope) {
	expect(env.stages.commit.hasRun).toBe(true)
	return env.stages.commit as any
}

const makeCommitEnv = (patch?: any) => resetStagesUpTo("commit", makeEnv(patch))

test("commits only PROVISIONAL produced artifacts", () => {
	const env = makeCommitEnv()

	;(env.stages.revalidation as any).directive = {
		...(env.stages.revalidation as any).directive,
		outcome: "APPROVE_COMMIT" as const,
		commitAllowList: ["note_1", "report_1"],
	}

	;(env.stages.execution as any).effectsLog = makeValidEffectsLog({
		producedEffects: [
			{
				stableId: "producedEffect_1",
				effectType: "ARTIFACT",
				objectId: "note_1",
				kind: "NOTE",
				trust: "PROVISIONAL",
			},
			{
				stableId: "producedEffect_2",
				effectType: "ARTIFACT",
				objectId: "report_1",
				kind: "REPORT",
				trust: "PROVISIONAL",
			},
			{
				stableId: "producedEffect_3",
				effectType: "ARTIFACT",
				objectId: "note_2",
				kind: "NOTE",
				trust: "COMMITTED",
			},
			{
				stableId: "producedEffect_4",
				effectType: "ARTIFACT",
				objectId: "raw_1",
				kind: "RAW",
				trust: "UNTRUSTED",
			},
		],
	})

	const out = commitStage(env)
	const nextEnv = unwrapRight(out)

	expect(nextEnv.errors.length).toBe(0)

	const c = getCommitRecord(nextEnv)
	assertMatchId(c.proposalId, "proposal_")
	assertMatchId(c.commitId, "commit_")

	expect(c.effects.approved.length).toBe(2)
	expect(c.effects.approved.map((o: any) => o.objectId).sort()).toEqual([
		"note_1",
		"report_1",
	])

	for (const obj of c.effects.approved) {
		expect(obj.trust).toBe("COMMITTED")
		expect(typeof obj.stableId).toBe("string")
		expect(obj.stableId.length > 0).toBeTruthy()
	}
})

test("commits nothing if there are no PROVISIONAL artifacts", () => {
	const env = makeCommitEnv()

	;(env.stages.revalidation as any).directive = {
		...(env.stages.revalidation as any).directive,
		outcome: "APPROVE_COMMIT" as const,
		commitAllowList: [],
	}

	;(env.stages.execution as any).effectsLog = makeValidEffectsLog({
		producedEffects: [
			{
				stableId: "producedEffect_1",
				effectType: "ARTIFACT",
				objectId: "note_2",
				kind: "NOTE",
				trust: "COMMITTED",
			},
			{
				stableId: "producedEffect_2",
				effectType: "ARTIFACT",
				objectId: "raw_1",
				kind: "RAW",
				trust: "UNTRUSTED",
			},
		],
	})

	const out = commitStage(env)
	const nextEnv = unwrapRight(out)

	expect(nextEnv.errors.length).toBe(0)

	const c = getCommitRecord(nextEnv)
	expect(c.effects.approved.length).toBe(0)
	expect(c.promotions.length).toBe(0)

	// outbox should also be empty
	expect(c.outbox).toBeInstanceOf(Array)
	expect(c.outbox.length).toBe(0)
})

test("fails closed when revalidation.proposalId mismatches envelope proposalId", () => {
	const env = makeCommitEnv({
		ids: { proposalId: "proposal_1" },
	})

	;(env.stages.revalidation as any).proposalId = "proposal_X"
	;(env.stages.revalidation as any).directive = {
		...(env.stages.revalidation as any).directive,
		proposalId: "proposal_X",
		outcome: "APPROVE_COMMIT" as const,
		commitAllowList: [],
	}

	const out = commitStage(env)
	const left = unwrapLeft(out)

	expect(left.env.errors.length >= 1).toBeTruthy()

	const err = lastError(left.env) as any
	expect(err.stage).toBe("COMMIT")
	expect(err.severity).toBe("HALT")
	expect(err.code).toBe("COMMIT_INPUT_MISMATCH")

	expect(left.env.stages.commit.hasRun).toBeFalsy()
})

test("fails closed on unsupported outcome (REJECT_COMMIT)", () => {
	const env = makeCommitEnv()

	;(env.stages.revalidation as any).directive = {
		...(env.stages.revalidation as any).directive,
		outcome: "REJECT_COMMIT" as const,
		commitAllowList: [],
	}

	const out = commitStage(env)
	const left = unwrapLeft(out)

	const err = lastError(left.env) as any
	expect(err.stage).toBe("COMMIT")
	expect(err.severity).toBe("HALT")
	expect(err.code).toBe("COMMIT_OUTCOME_UNSUPPORTED")

	expect(left.env.stages.commit.hasRun).toBeFalsy()
})

test("PARTIAL_COMMIT with empty allowlist commits nothing (but emits commit record)", () => {
	const env = makeCommitEnv()

	;(env.stages.revalidation as any).directive = {
		...(env.stages.revalidation as any).directive,
		outcome: "PARTIAL_COMMIT" as const,
		commitAllowList: [],
	}

	;(env.stages.execution as any).effectsLog = makeValidEffectsLog({
		producedEffects: [
			{
				stableId: "producedEffect_1",
				effectType: "ARTIFACT",
				objectId: "note_1",
				kind: "NOTE",
				trust: "PROVISIONAL",
			},
		],
	})

	const out = commitStage(env)
	const nextEnv = unwrapRight(out)

	expect(nextEnv.errors.length).toBe(0)

	const c = getCommitRecord(nextEnv)
	expect(c.effects.approved.length).toBe(0)
	expect(c.promotions.length).toBe(0)

	// outbox should be empty because nothing approved
	expect(c.outbox).toBeInstanceOf(Array)
	expect(c.outbox.length).toBe(0)
})

test("PARTIAL_COMMIT commits only allowlisted PROVISIONAL artifacts", () => {
	const env = makeCommitEnv()

	;(env.stages.revalidation as any).directive = {
		...(env.stages.revalidation as any).directive,
		outcome: "PARTIAL_COMMIT" as const,
		commitAllowList: ["note_1"],
	}

	;(env.stages.execution as any).effectsLog = makeValidEffectsLog({
		producedEffects: [
			{
				stableId: "producedEffect_1",
				effectType: "ARTIFACT",
				objectId: "note_1",
				kind: "NOTE",
				trust: "PROVISIONAL",
			},
			{
				stableId: "producedEffect_2",
				effectType: "ARTIFACT",
				objectId: "report_1",
				kind: "REPORT",
				trust: "PROVISIONAL",
			},
		],
	})

	const out = commitStage(env)
	const nextEnv = unwrapRight(out)

	expect(nextEnv.errors.length).toBe(0)

	const c = getCommitRecord(nextEnv)
	expect(c.effects.approved.length).toBe(1)
	expect(c.effects.approved[0].objectId).toBe("note_1")
	expect(c.promotions.length).toBe(1)
	expect(c.promotions[0].objectId).toBe("note_1")
})

test("PARTIAL_COMMIT fails when allowlist references unknown objects", () => {
	const env = makeCommitEnv()

	;(env.stages.revalidation as any).directive = {
		...(env.stages.revalidation as any).directive,
		outcome: "PARTIAL_COMMIT" as const,
		commitAllowList: ["ghost_id"],
	}

	;(env.stages.execution as any).effectsLog = makeValidEffectsLog({
		producedEffects: [
			{
				stableId: "producedEffect_1",
				effectType: "ARTIFACT",
				objectId: "note_1",
				kind: "NOTE",
				trust: "PROVISIONAL",
			},
		],
	})

	const out = commitStage(env)
	const left = unwrapLeft(out)

	expect(left.env.stages.commit.hasRun).toBeFalsy()

	const err = lastError(left.env) as any
	expect(err.stage).toBe("COMMIT")
	expect(err.severity).toBe("HALT")
	expect(err.code).toBe("ALLOWLIST_UNKNOWN_OBJECT")
})

test("does not emit promotions for non-PROVISIONAL artifacts (records rejectedEffects)", () => {
	const env = makeCommitEnv()

	;(env.stages.revalidation as any).directive = {
		...(env.stages.revalidation as any).directive,
		outcome: "APPROVE_COMMIT" as const,
		commitAllowList: ["note_2", "raw_1"],
	}

	;(env.stages.execution as any).effectsLog = makeValidEffectsLog({
		producedEffects: [
			{
				stableId: "producedEffect_1",
				effectType: "ARTIFACT",
				objectId: "note_2",
				kind: "NOTE",
				trust: "COMMITTED",
			},
			{
				stableId: "producedEffect_2",
				effectType: "ARTIFACT",
				objectId: "raw_1",
				kind: "RAW",
				trust: "UNTRUSTED",
			},
		],
	})

	const out = commitStage(env)
	const nextEnv = unwrapRight(out)

	expect(nextEnv.errors.length).toBe(0)

	const c = getCommitRecord(nextEnv)
	expect(c.effects.approved.length).toBe(0)
	expect(c.promotions.length).toBe(0)

	// coverage: rejectedEffects should be recorded
	expect(c.effects.rejected).toBeInstanceOf(Array)

	expect(c.effects.rejected.map((e: any) => e.objectId).sort()).toEqual([
		"note_2",
		"raw_1",
	])
})

/////////////////////////
// Outbox-specific tests
/////////////////////////

test("outbox: emits one entry per approved effect and includes required metadata", () => {
	const env = makeCommitEnv()

	;(env.stages.revalidation as any).directive = {
		...(env.stages.revalidation as any).directive,
		outcome: "APPROVE_COMMIT" as const,
		commitAllowList: ["note_1", "report_1"],
	}

	;(env.stages.execution as any).effectsLog = makeValidEffectsLog({
		producedEffects: [
			{
				stableId: "producedEffect_1",
				effectType: "ARTIFACT",
				objectId: "note_1",
				kind: "NOTE",
				trust: "PROVISIONAL",
			},
			{
				stableId: "producedEffect_2",
				effectType: "ARTIFACT",
				objectId: "report_1",
				kind: "REPORT",
				trust: "PROVISIONAL",
			},
		],
	})

	const out = commitStage(env)
	const nextEnv = unwrapRight(out)

	const c = getCommitRecord(nextEnv)

	expect(c.outbox).toBeInstanceOf(Array)
	expect(c.outbox.length).toBe(c.effects.approved.length)
	expect(c.outbox.length).toBe(2)

	// Entry-level invariants
	for (const entry of c.outbox) {
		assertMatchId(entry.outboxId, "outbox_")
		expect(entry.pipeline).toBe(PIPELINE_NAME)
		expect(entry.stage).toBe("COMMIT")
		expect(typeof entry.idempotencyKey).toBe("string")
		expect(entry.idempotencyKey.length > 0).toBeTruthy()

		// status expectation: align with your current commit implementation
		expect(entry.status).toBe("PENDING")

		expect(typeof entry.createdAt).toBe("number")
		expect(typeof entry.updatedAt).toBe("number")
		expect(entry.attempts).toBe(0)

		// effect should be the approved effect payload
		expect(entry.effect).toBeTruthy()
		expect(entry.effect.trust).toBe("COMMITTED")
		expect(typeof entry.effect.stableId).toBe("string")
	}

	// Ensure the outbox effects correspond to approved objectIds
	const approvedIds = c.effects.approved.map((e: any) => e.objectId).sort()
	const outboxIds = c.outbox.map((e: any) => e.effect.objectId).sort()
	expect(outboxIds).toEqual(approvedIds)
})

test("outbox: no approved effects => outbox is empty", () => {
	const env = makeCommitEnv()

	;(env.stages.revalidation as any).directive = {
		...(env.stages.revalidation as any).directive,
		outcome: "APPROVE_COMMIT" as const,
		commitAllowList: [],
	}

	;(env.stages.execution as any).effectsLog = makeValidEffectsLog({
		producedEffects: [
			{
				stableId: "producedEffect_1",
				effectType: "ARTIFACT",
				objectId: "note_2",
				kind: "NOTE",
				trust: "COMMITTED",
			},
		],
	})

	const out = commitStage(env)
	const nextEnv = unwrapRight(out)

	const c = getCommitRecord(nextEnv)
	expect(c.outbox).toBeInstanceOf(Array)
	expect(c.outbox.length).toBe(0)
})

test("outbox: on HALT/Left, commit stage must not emit outbox", () => {
	const env = makeCommitEnv()

	// force failure: missing required revalidation stage output
	;(env.stages.revalidation as any).hasRun = false

	const out = commitStage(env)
	const left = unwrapLeft(out)

	expect(left.env.stages.commit.hasRun).toBeFalsy()

	// outbox field should not exist on a not-run commit stage
	const c = left.env.stages.commit as any
	expect(c.outbox).toBeUndefined()
})
