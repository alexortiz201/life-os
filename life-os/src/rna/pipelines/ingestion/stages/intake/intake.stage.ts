import { fingerprint } from "#/domain/encoding/fingerprint";
import { getNewId } from "#/domain/identity/id.provider";
import { appendError } from "#/rna/envelope/envelope-utils";

import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";
import { IntakeEnvelope } from "#/types/rna/pipeline/ingestion/intake/intake.types";
import { guardPreIntake, guardIntake } from "./intake.guard";

export const STAGE = "INTAKE" as const;

export function intakeStage(env: IntakeEnvelope): IngestionPipelineEnvelope {
  const proposalId = env.ids.proposalId ?? getNewId("proposal");

  env.ids.proposalId = proposalId;

  if (env?.stages?.intake?.hasRun) {
    return appendError(env, {
      stage: STAGE,
      severity: "HALT",
      code: "STAGE_ALREADY_RAN",
      message: "Stage has already complete",
      trace: {
        info: env.stages["intake"],
      },
      at: Date.now(),
    });
  }

  // 1) prereqs (stage-level, before guard)
  const preReqRes = guardPreIntake(env);

  if (!preReqRes.ok) return preReqRes.env;

  // 2) run guard (guard plucks directly from env)
  const result = guardIntake(env);

  if (!result.ok) {
    return appendError(env, {
      stage: STAGE,
      severity: "HALT",
      code: result.code,
      message: result.message,
      trace: result.trace,
      at: Date.now(),
    });
  }

  // 3) write stage output back into envelope
  const ranAt = Date.now();
  const intakeId = getNewId("intake");

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
        observed: {
          proposalId,
        } as any,
        intakeId,
        proposal: {
          id: proposalId,
          createdAt: `${ranAt}`,
          actor: result.data.rawProposal.actor,
          kind: "PROPOSAL_RECORD",
          trust: "UNTRUSTED",
          proposalId,
          // normalized: string;
          fingerprint: fingerprint({
            proposalId: proposalId,
            actor: result.data.rawProposal.actor,
          }),
          intakeTimestamp: `${ranAt}`,
          rawProposal: result.data.rawProposal,
        },
      },
    },
  };
}
