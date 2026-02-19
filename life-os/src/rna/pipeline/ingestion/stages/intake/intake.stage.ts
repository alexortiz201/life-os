import * as E from "fp-ts/Either"
import { pipe } from "fp-ts/function"

import { fingerprint } from "#/domain/encoding/fingerprint"
import { getNewId } from "#/domain/identity/id.provider"
import {
	PROPOSAL_RECORD,
	PROPOSAL_UNTRUSTED,
} from "#/domain/proposals/proposals.const"
import {
	leftFromLastError,
	makeStageLeft,
} from "#/platform/pipeline/stage/stage"
import { appendError } from "#/rna/envelope/envelope-utils"
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types"
import { STAGE } from "./intake.const"
import { guardIntake, guardPreIntake } from "./intake.guard"
import type {
	IntakeEnvelope,
	IntakeErrorCode,
	IntakeStage,
} from "./intake.types"

const left = makeStageLeft<IntakeEnvelope>(appendError as any)

export const intakeStage: IntakeStage = (env) =>
	pipe(
		E.right(env),

		E.chain((env) =>
			env?.stages?.intake?.hasRun
				? left({
						env,
						stage: STAGE,
						code: "STAGE_ALREADY_RAN",
						message: "Stage has already complete",
						trace: { info: env.stages["intake"] },
					})
				: E.right(env)
		),

		E.map((env) => {
			const proposalId = env.ids.proposalId ?? getNewId("proposal")
			return { ...env, ids: { ...env.ids, proposalId } }
		}),

		E.chain((env) => {
			const pre = guardPreIntake(env)
			return pre.ok
				? E.right(pre.env as IntakeEnvelope)
				: leftFromLastError(env)
		}),

		E.chain((env) => {
			const g = guardIntake(env)
			return g.ok
				? E.right({ env, data: g.data })
				: left({
						env,
						stage: STAGE,
						code: g.code as IntakeErrorCode,
						message: g.message,
						trace: g.trace,
					})
		}),

		E.map(({ env, data }) => {
			const ranAt = Date.now()
			const intakeId = getNewId("intake")
			const proposalId = env.ids.proposalId
			const intake = {
				hasRun: true,
				ranAt,
				observed: { proposalId },
				intakeId,
				proposal: {
					id: proposalId,
					createdAt: `${ranAt}`,
					actor: data.rawProposal.actor,
					kind: PROPOSAL_RECORD,
					trust: PROPOSAL_UNTRUSTED,
					proposalId,
					fingerprint: fingerprint({
						proposalId,
						actor: data.rawProposal.actor,
					}),
					intakeTimestamp: `${ranAt}`,
					rawProposal: data.rawProposal,
				},
			} satisfies IngestionPipelineEnvelope["stages"]["intake"]

			return {
				...env,
				ids: { ...env.ids, intakeId },
				stages: { ...env.stages, intake },
			}
		})
	)
