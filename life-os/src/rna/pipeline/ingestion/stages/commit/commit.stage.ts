import * as E from "fp-ts/Either"
import { pipe } from "fp-ts/function"
import { fingerprint } from "#/domain/encoding/fingerprint"
import { getNewId } from "#/domain/identity/id.provider"
import { guardTrustPromotion } from "#/domain/trust/trustPromotion.guard"
import type { OutboxEntryOpaque } from "#/platform/outbox/outbox.types"
import {
	leftFromLastError,
	makeStageLeft,
} from "#/platform/pipeline/stage/stage"
import { appendError, hasHaltingErrors } from "#/rna/envelope/envelope-utils"
import { PIPELINE_NAME } from "#/rna/pipeline/ingestion/ingestion.const"
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types"
import { STAGE, TRUST_COMMMITED, TRUST_PROVISIONAL } from "./commit.const"
import { guardCommit, guardPreCommit, postGuardCommit } from "./commit.guard"
import type { Commit, CommitErrorCode, CommitStage } from "./commit.types"

const TRUST_FROM = TRUST_PROVISIONAL
const TRUST_TO = TRUST_COMMMITED

const left = makeStageLeft<IngestionPipelineEnvelope>(appendError)

export const commitStage: CommitStage = (env) => {
	// 0) fail closed if earlier stage produced HALT errors
	if (hasHaltingErrors(env)) return E.right(env)

	return pipe(
		E.right(env),

		// 1) prereqs
		E.chain((env) => {
			const pre = guardPreCommit(env)

			return pre.ok
				? E.right(pre.env)
				: leftFromLastError<
						IngestionPipelineEnvelope,
						typeof STAGE,
						CommitErrorCode
					>(pre.env)
		}),

		// 2) guard (schema/contract)
		E.chain((env) => {
			const g = guardCommit(env)

			if (g.ok) return E.right({ env, data: g.data })

			return left({
				env,
				stage: STAGE,
				code: g.code as CommitErrorCode,
				message: g.message,
				trace: g.trace,
			})
		}),

		// 3) post-guard (stage-specific semantic rules)
		E.chain(({ env, data }) => {
			const g = postGuardCommit({ env, data })

			return g.ok
				? E.right({ env, data: g.data }) // often you return refined data
				: left({
						env,
						stage: STAGE,
						code: g.code as CommitErrorCode,
						message: g.message,
						trace: g.trace,
					})
		}),

		// 3) build commit record + stage output
		E.map(({ env, data }) => {
			const ranAt = Date.now()
			const commitId = getNewId("commit")
			const proposalId = data.proposalId
			const outcome = data.outcome

			const approvedEffects: Commit["effects"]["approved"] = []
			const rejectedEffects: Commit["effects"]["rejected"] = [
				...data.effects.rejected.artifacts,
				...data.effects.rejected.events,
			]
			const ignoredEffects: Commit["effects"]["ignored"] = [
				...data.effects.ignored.artifacts,
				...data.effects.ignored.events,
				...data.effects.ignored.unknown,
			]

			const justification: Commit["justification"] = {
				mode: data.mode,
				rulesApplied: data.rulesApplied,
				inputs: [{ commitId, proposalId, allowListCount: data.allowListCount }],
			}

			const promotions: Commit["promotions"] = []

			// If PARTIAL with empty allowlist -> commit nothing, still emit record + stage output
			if (
				data.mode === "PARTIAL" &&
				data.effects.eligible.artifacts.length === 0
			) {
				return {
					...env,
					ids: { ...env.ids, commitId },
					stages: {
						...env.stages,
						commit: {
							hasRun: true,
							ranAt,
							commitId,
							proposalId,
							observed: {
								proposalId: env.ids.proposalId,
								snapshotId: env.ids.snapshotId,
								revalidationId: env.ids.revalidationId,
								effectsLogId: env.ids.effectsLogId,
							},
							promotions,
							justification,
							effects: {
								approved: approvedEffects,
								rejected: rejectedEffects,
								ignored: ignoredEffects,
							},
							outcome,
							outbox: [],
						},
					},
				} satisfies IngestionPipelineEnvelope
			}

			const effectsLogId = data.effectsLogId

			for (const obj of data.effects.eligible.artifacts) {
				const reason =
					"Commit stage promotion of provisional execution outputs."
				const guard = guardTrustPromotion({
					from: obj.trust,
					to: TRUST_TO,
					stage: STAGE,
					reason,
				})

				if (!guard.ok) {
					rejectedEffects.push({
						...obj,
						originalTrust: TRUST_FROM,
						reasonCode: guard.code,
						reason: guard.message,
					})
					continue
				}

				approvedEffects.push({
					stableId: obj.stableId,
					effectType: obj.effectType,
					objectId: obj.objectId,
					kind: obj.kind,
					trust: TRUST_TO,
				})

				promotions.push({
					objectId: obj.objectId,
					from: TRUST_FROM,
					to: TRUST_TO,
					stage: STAGE,
					reason,
					effectsLogId,
					commitId,
					proposalId,
				})
			}

			const commit = {
				hasRun: true,
				ranAt,
				commitId,
				proposalId,
				observed: {
					snapshotId: env.ids.snapshotId,
					proposalId: env.ids.proposalId,
					intakeId: env.ids.intakeId,
					validationId: env.ids.validationId,
					planningId: env.ids.planningId,
					effectsLogId: env.ids.effectsLogId,
					revalidationId: env.ids.revalidationId,
				},
				promotions,
				justification,
				effects: {
					approved: approvedEffects,
					rejected: rejectedEffects,
					ignored: ignoredEffects,
				},
				outcome,
				outbox: [],
			}

			return {
				...env,
				ids: { ...env.ids, commitId },
				stages: { ...env.stages, commit },
			} as IngestionPipelineEnvelope
		}),

		// 4) build outbox + stage output
		E.map((env) => {
			const commit = env.stages.commit

			if (!commit.hasRun) return env

			const approvedEffects = commit.effects.approved

			if (!approvedEffects.length) return env

			const effectsToApply: OutboxEntryOpaque[] = approvedEffects.map(
				(effect) =>
					({
						outboxId: getNewId("outbox"),
						idempotencyKey: fingerprint({
							pipeline: PIPELINE_NAME,
							stage: STAGE,
							commitId: commit.commitId,

							effectType: effect.effectType,
							objectId: (effect as any).objectId,
							kind: (effect as any).kind,
						}),
						status: "PENDING",
						attempts: 0,
						createdAt: commit.ranAt,
						updatedAt: commit.ranAt,
						pipeline: PIPELINE_NAME,
						stage: STAGE,
						effect,
					}) satisfies OutboxEntryOpaque
			)

			return {
				...env,
				stages: {
					...env.stages,
					commit: {
						...commit,
						outbox: effectsToApply,
					},
				},
			}
		})
	)
}
