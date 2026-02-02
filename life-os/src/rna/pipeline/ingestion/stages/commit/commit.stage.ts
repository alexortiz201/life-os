import { pipe } from "fp-ts/function";
import * as E from "fp-ts/Either";

import { getNewId } from "#/domain/identity/id.provider";
import { guardTrustPromotion } from "#/domain/trust/trustPromotion.guard";
import {
  leftFromLastError,
  makeStageLeft,
  PipelineStageFn,
} from "#/platform/pipeline/stage/stage";

import { appendError, hasHaltingErrors } from "#/rna/envelope/envelope-utils";
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";

import type { CommitErrorCode, Commit } from "./commit.types";
import { guardPreCommit, guardCommit, postGuardCommit } from "./commit.guard";
import { STAGE, TRUST_COMMMITED, TRUST_PROVISIONAL } from "./commit.const";

const TRUST_FROM = TRUST_PROVISIONAL;
const TRUST_TO = TRUST_COMMMITED;

const left = makeStageLeft<IngestionPipelineEnvelope>(appendError);

export type CommitStage = PipelineStageFn<
  IngestionPipelineEnvelope,
  typeof STAGE,
  CommitErrorCode
>;

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
        : leftFromLastError<
            IngestionPipelineEnvelope,
            typeof STAGE,
            CommitErrorCode
          >(pre.env);
    }),

    // 2) guard (schema/contract)
    E.chain((env) => {
      const g = guardCommit(env);

      if (g.ok) return E.right({ env, data: g.data });

      return left({
        env,
        stage: STAGE,
        code: g.code as CommitErrorCode,
        message: g.message,
        trace: g.trace,
      });
    }),

    // 3) post-guard (stage-specific semantic rules)
    E.chain(({ env, data }) => {
      const g = postGuardCommit({ env, data });

      return g.ok
        ? E.right({ env, data: g.data }) // often you return refined data
        : left({
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

      const approvedEffects: Commit["effects"]["approved"] = [];
      const rejectedEffects: Commit["effects"]["rejected"] = [
        ...data.effects.rejected.artifacts,
        ...data.effects.rejected.events,
      ];
      const ignoredEffects: Commit["effects"]["ignored"] = [
        ...data.effects.ignored.artifacts,
        ...data.effects.ignored.events,
        ...data.effects.ignored.unknown,
      ];

      const justification: Commit["justification"] = {
        mode: data.mode,
        rulesApplied: data.rulesApplied,
        inputs: [{ commitId, proposalId, allowListCount: data.allowListCount }],
      };

      const promotions: Commit["promotions"] = [];

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
        };
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
        ...applyInfo,
      } satisfies IngestionPipelineEnvelope["stages"]["commit"];

      return {
        ...env,
        ids: { ...env.ids, commitId },
        stages: { ...env.stages, commit },
      };
    }),
  );
};
