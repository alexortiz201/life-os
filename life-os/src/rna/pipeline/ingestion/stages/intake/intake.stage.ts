import { pipe } from "fp-ts/function";
import * as E from "fp-ts/Either";

import { fingerprint } from "#/domain/encoding/fingerprint";
import { getNewId } from "#/domain/identity/id.provider";
import { appendError } from "#/rna/envelope/envelope-utils";

import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";
import type { IntakeEnvelope } from "#/rna/pipeline/ingestion/stages/intake/intake.types";
import { guardPreIntake, guardIntake } from "./intake.guard";
import {
  leftFromLastError,
  makeStageLeft,
  StageLeft,
} from "#/platform/pipeline/stage/stage";

export const STAGE = "INTAKE" as const;

export type IntakeErrorCode =
  | "STAGE_ALREADY_RAN"
  | "INTAKE_PREREQ_MISSING"
  | "INVALID_INTAKE_INPUT";

// NOTE: If appendError is typed to IngestionPipelineEnvelope only,
// but IntakeEnvelope structurally extends it, this should still work.
// If TS complains, cast appendError as (env: IntakeEnvelope, err: any) => IntakeEnvelope.
const left = makeStageLeft<IntakeEnvelope>(appendError as any);

export type IntakeStage = (
  env: IntakeEnvelope
) => E.Either<
  StageLeft<IntakeEnvelope, typeof STAGE, IntakeErrorCode>,
  IngestionPipelineEnvelope
>;

export const intakeStage: IntakeStage = (env) => {
  return pipe(
    E.right(env),

    // 0) fail-closed if re-run (and do not mutate ids)
    E.chain((env) => {
      if (env?.stages?.intake?.hasRun) {
        return left({
          env,
          stage: STAGE,
          code: "STAGE_ALREADY_RAN",
          message: "Stage has already complete",
          trace: { info: env.stages["intake"] },
        });
      }
      return E.right(env);
    }),

    // 1) ensure proposalId exists (immutably)
    E.map((env) => {
      const proposalId = env.ids.proposalId ?? getNewId("proposal");
      const withProposalId: IntakeEnvelope = {
        ...env,
        ids: { ...env.ids, proposalId },
      };
      return withProposalId;
    }),

    // 2) prereqs (stage-level, before guard)
    E.chain((env) => {
      const pre = guardPreIntake(env as any);
      return pre.ok
        ? E.right(pre.env as IntakeEnvelope)
        : leftFromLastError(pre.env as IntakeEnvelope);
    }),

    // 3) run guard (guard plucks directly from env)
    E.chain((env) => {
      const g = guardIntake(env);

      if (g.ok) return E.right({ env, data: g.data });

      return left({
        env,
        stage: STAGE,
        code: g.code as IntakeErrorCode, // if g.code is wider than IntakeErrorCode
        message: g.message,
        trace: g.trace,
      });
    }),

    // 4) write stage output back into envelope
    E.map(({ env, data }) => {
      const ranAt = Date.now();
      const intakeId = getNewId("intake");
      const proposalId = env.ids.proposalId!; // guaranteed by step (1)

      return {
        ...env,
        ids: {
          ...env.ids,
          intakeId,
        },
        stages: {
          ...env.stages,
          intake: {
            hasRun: true,
            ranAt,
            observed: { proposalId } as any,
            intakeId,
            proposal: {
              id: proposalId,
              createdAt: `${ranAt}`,
              actor: data.rawProposal.actor,
              kind: "PROPOSAL_RECORD",
              trust: "UNTRUSTED",
              proposalId,
              fingerprint: fingerprint({
                proposalId,
                actor: data.rawProposal.actor,
              }),
              intakeTimestamp: `${ranAt}`,
              rawProposal: data.rawProposal,
            },
          },
        },
      } as IngestionPipelineEnvelope;
    })
  );
};
