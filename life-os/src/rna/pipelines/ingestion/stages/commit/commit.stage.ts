import { pipe } from "fp-ts/function";
import * as E from "fp-ts/Either";

import { guardTrustPromotion } from "#/domain/trust/trustPromotion.guard";
import { appendError, hasHaltingErrors } from "#/rna/envelope/envelope-utils";

import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";
import type { CommitRecord } from "#/rna/pipeline/ingestion/commit/commit.types";

import { guardPreCommit, guardCommit } from "./commit.guard";
import { getNewId } from "#/domain/identity/id.provider";
import { makeStageLeft, StageLeft } from "#/platform/pipeline/stage/stage";

export const STAGE = "COMMIT" as const;

const TRUST_PROVISIONAL = "PROVISIONAL";
const TRUST_COMMMITED = "COMMITTED";

const TRUST_FROM = TRUST_PROVISIONAL;
const TRUST_TO = TRUST_COMMMITED;

export type CommitErrorCode =
  | "INVALID_COMMIT_INPUT"
  | "COMMIT_PREREQ_MISSING"
  | "PARTIAL_NOT_ALLOWED";

const left = makeStageLeft<IngestionPipelineEnvelope>(appendError);

export type CommitStage = (
  env: IngestionPipelineEnvelope
) => E.Either<StageLeft<"COMMIT", CommitErrorCode>, IngestionPipelineEnvelope>;

export const commitStage: CommitStage = (env) => {
  // 0) fail closed if earlier stage produced HALT errors
  if (hasHaltingErrors(env)) return E.right(env);

  return pipe(
    E.right(env),

    // 1) prereqs
    E.chain((env) => {
      const pre = guardPreCommit(env);
      return pre.ok
        ? E.right(pre.env)
        : left({
            env: pre.env,
            stage: STAGE,
            code: "COMMIT_PREREQ_MISSING",
            message: "Commit prereqs missing.",
            trace: { why: "preGuardFactory" },
          });
    }),

    // 2) run guard (schema / contract)
    E.chain((env) => {
      const g = guardCommit(env);

      if (g.ok) return E.right({ env, data: g.data });

      const nextEnv = appendError(env, {
        stage: STAGE,
        severity: "HALT",
        code: g.code,
        message: g.message,
        trace: g.trace,
        at: Date.now(),
      });

      return left({
        env,
        stage: STAGE,
        code: g.code as CommitErrorCode,
        message: g.message,
        trace: g.trace,
      });
    }),

    // 3) build commit record + stage output
    E.map(({ env, data }) => {
      const ranAt = Date.now();
      const commitId = getNewId("commit");
      const proposalId = data.proposalId;
      const outcome = data.outcome;

      const approvedEffects: CommitRecord["effects"]["approved"] = [];
      const rejectedEffects: CommitRecord["effects"]["rejected"] = [
        ...data.effects.rejected.artifacts,
        ...data.effects.rejected.events,
      ];
      const ignoredEffects: CommitRecord["effects"]["ignored"] = [
        ...data.effects.ignored.artifacts,
        ...data.effects.ignored.events,
        ...data.effects.ignored.unknown,
      ];

      const justification: CommitRecord["justification"] = {
        mode: data.mode,
        rulesApplied: data.rulesApplied,
        inputs: [{ commitId, proposalId, allowListCount: data.allowListCount }],
      };

      const promotions: CommitRecord["promotions"] = [];

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
            },
          },
        } as IngestionPipelineEnvelope;
      }

      const effectsLogId = data.effectsLogId;

      for (const obj of data.effects.eligible.artifacts) {
        const reason =
          "Commit stage promotion of provisional execution outputs.";
        const guard = guardTrustPromotion({
          from: obj.trust,
          to: TRUST_TO,
          stage: STAGE,
          reason,
        });

        if (!guard.ok) {
          rejectedEffects.push({
            ...obj,
            originalTrust: TRUST_FROM,
            reasonCode: guard.code,
            reason: guard.message,
          });
          continue;
        }

        approvedEffects.push({
          objectId: obj.objectId,
          kind: obj.kind,
          trust: TRUST_TO,
        });

        promotions.push({
          objectId: obj.objectId,
          from: TRUST_FROM,
          to: TRUST_TO,
          stage: STAGE,
          reason,
          effectsLogId,
          commitId,
          proposalId,
        });
      }

      const applyInfo =
        outcome === "REJECT_COMMIT"
          ? {}
          : {
              apply: {
                status: "PENDING",
                attempts: 0,
                lastError: undefined,
                appliedAt: undefined,
              },
            };

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
            ...applyInfo,
          },
        },
      } as IngestionPipelineEnvelope;
    })
  );
};
