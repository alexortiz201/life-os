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
  PipelineStageFn,
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

export type IntakeStage = PipelineStageFn<
  IntakeEnvelope,
  typeof STAGE,
  IntakeErrorCode,
  IngestionPipelineEnvelope
>;

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
      const proposalId = env.ids.proposalId ?? getNewId("proposal");
      return { ...env, ids: { ...env.ids, proposalId } };
    }),

    E.chain((env) => {
      const pre = guardPreIntake(env as any);
      return pre.ok
        ? E.right(pre.env as IntakeEnvelope)
        : leftFromLastError(env);
    }),

    E.chain((env) => {
      const g = guardIntake(env);
      return g.ok
        ? E.right({ env, data: g.data })
        : left({
            env,
            stage: STAGE,
            code: g.code as IntakeErrorCode,
            message: g.message,
            trace: g.trace,
          });
    }),

    E.map(({ env, data }) => {
      const ranAt = Date.now();
      const intakeId = getNewId("intake");
      const proposalId = env.ids.proposalId!;
      const intake = {
        hasRun: true,
        ranAt,
        observed: { proposalId },
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
      } satisfies IngestionPipelineEnvelope["stages"]["intake"];

      return {
        ...env,
        ids: { ...env.ids, intakeId },
        stages: { ...env.stages, intake },
      };
    })
  );
