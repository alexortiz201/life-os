import * as E from "fp-ts/Either"

import { pipe } from "fp-ts/function"
import { expect, test } from "vitest"
import { commitStage } from "#/rna/pipeline/ingestion/stages/commit/commit.stage"
import { executionStage } from "#/rna/pipeline/ingestion/stages/execution/execution.stage"
// stages
import { intakeStage } from "#/rna/pipeline/ingestion/stages/intake/intake.stage"
import type { IntakeEnvelope } from "#/rna/pipeline/ingestion/stages/intake/intake.types"
import { planningStage } from "#/rna/pipeline/ingestion/stages/planning/planning.stage"
import { revalidationStage } from "#/rna/pipeline/ingestion/stages/revalidation/revalidation.stage"
import { validationStage } from "#/rna/pipeline/ingestion/stages/validation/validation.stage"

// shared test utils
import {
	makeEnv as makeEnvUtil,
	resetStagesUpTo,
	unwrapLeft,
	unwrapRight,
} from "#/shared/test-utils"

/**
 * Build a “valid enough” env that can traverse the entire spine.
 * Adjust any specifics to match your schemas (kinds / allow list / etc).
 */
function makeE2eEnv(): IntakeEnvelope {
	const env = makeEnvUtil({
		stages: {
			intake: { hasRun: false },
			validation: { hasRun: false },
			planning: { hasRun: false },
			execution: { hasRun: false },
			revalidation: { hasRun: false },
			commit: { hasRun: false },
		},
	})

	// If you’re using this helper elsewhere, keep it consistent.
	const base = resetStagesUpTo("intake", env)

	// Make sure snapshot/ids prereqs exist (your makeEnv likely already does this)
	base.ids.snapshotId = base.ids.snapshotId ?? "snapshot_1"

	return {
		...(base as any),
		snapshot: {
			...(base as any).snapshot,
			permissions: {
				actor: { actorId: "user_1", actorType: "USER" },
				allow: ["WEEKLY_REFLECTION"] as const,
			},
		},
		rawProposal: {
			intent: "weekly reflection",
			actor: { actorId: "user_1", actorType: "USER" },
			target: { entity: "self", scope: { allowedKinds: ["NOTE"] as const } },
			dependencies: [],
			impact: "LOW",
			reversibilityClaim: "REVERSIBLE",
		},
	} as IntakeEnvelope
}

test("E2E: ingestion spine runs end-to-end and produces a commit record", () => {
	const out = pipe(
		E.right(makeE2eEnv()),
		E.chainW(intakeStage),
		E.chainW(validationStage),
		E.chainW(planningStage),
		E.chainW(executionStage),
		E.chainW(revalidationStage),
		E.chainW(commitStage)
	)

	const finalEnv = unwrapRight(out)

	// stage progression
	expect(finalEnv.stages.intake.hasRun).toBeTruthy()
	expect(finalEnv.stages.validation.hasRun).toBeTruthy()
	expect(finalEnv.stages.planning.hasRun).toBeTruthy()
	expect(finalEnv.stages.execution.hasRun).toBeTruthy()
	expect(finalEnv.stages.revalidation.hasRun).toBeTruthy()
	expect(finalEnv.stages.commit.hasRun).toBeTruthy()

	// ids should exist by the end
	expect(finalEnv.ids.proposalId).toBeTruthy()
	expect(finalEnv.ids.intakeId).toBeTruthy()
	expect(finalEnv.ids.validationId).toBeTruthy()
	expect(finalEnv.ids.planningId).toBeTruthy()
	expect(finalEnv.ids.executionId).toBeTruthy()
	expect(finalEnv.ids.effectsLogId).toBeTruthy()
	expect(finalEnv.ids.revalidationId).toBeTruthy()
	expect(finalEnv.ids.commitId).toBeTruthy()

	// commit record shape (high-level invariant)
	const c = finalEnv.stages.commit as any
	expect(c.commitId).toBe(finalEnv.ids.commitId)
	expect(c.proposalId).toBe(finalEnv.ids.proposalId)

	expect(c.effects).toBeTruthy()
	expect(c.effects.approved).toBeInstanceOf(Array)
	expect(c.effects.rejected).toBeInstanceOf(Array)
	expect(c.effects.ignored).toBeInstanceOf(Array)

	// “trust boundary” baseline: commit promotes to COMMITTED (if anything is approved)
	for (const obj of c.effects.approved) {
		expect(obj.trust).toBe("COMMITTED")
	}
})

test("E2E: validation halts when snapshot permissions allowlist is empty", () => {
	const env = makeE2eEnv()

	// violate validation invariant
	;(env as any).snapshot = {
		...(env as any).snapshot,
		permissions: {
			actor: { actorId: "user_1", actorType: "USER" },
			allow: [] as const,
		},
	}

	const out = pipe(
		E.right(env),
		E.chainW(intakeStage),
		E.chainW(validationStage) // should Left here
	)

	const left = unwrapLeft(out)

	// the “stage left” wrapper pattern you’re using:
	expect(left.env.errors.length >= 1).toBeTruthy()
	const err = left.env.errors[left.env.errors.length - 1] as any

	expect(err.stage).toBe("VALIDATION")
	expect(err.severity).toBe("HALT")
	expect(err.code).toBe("SNAPSHOT_PERMISSION_NOT_ALLOWED")

	// should not advance
	expect(left.env.stages.planning.hasRun).toBeFalsy()
	expect(left.env.stages.execution.hasRun).toBeFalsy()
})
