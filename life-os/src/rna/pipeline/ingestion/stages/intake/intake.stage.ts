import { fingerprint } from "#/domain/encoding/fingerprint";
import { getNewId } from "#/domain/identity/id.provider";
import { appendError } from "#/rna/envelope/envelope-utils";

import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";
import { IntakeEnvelope } from "#/rna/pipeline/ingestion/stages/intake/intake.types";
import { guardPreIntake, guardIntake } from "./intake.guard";

export const STAGE = "INTAKE" as const;

export function intakeStage(env: IntakeEnvelope): IngestionPipelineEnvelope {
  // 0) fail-closed if re-run (and do not mutate ids)
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

  // 1) ensure proposalId exists (immutably)
  const proposalId = env.ids.proposalId ?? getNewId("proposal");
  const withProposalId: IntakeEnvelope = {
    ...env,
    ids: {
      ...env.ids,
      proposalId,
    },
  };

  // 2) prereqs (stage-level, before guard)
  const preReqRes = guardPreIntake(withProposalId);
  if (!preReqRes.ok) return preReqRes.env;

  // 3) run guard (guard plucks directly from env)
  const result = guardIntake(preReqRes.env as IntakeEnvelope);

  if (!result.ok) {
    return appendError(preReqRes.env, {
      stage: STAGE,
      severity: "HALT",
      code: result.code,
      message: result.message,
      trace: result.trace,
      at: Date.now(),
    });
  }

  // 4) write stage output back into envelope
  const ranAt = Date.now();
  const intakeId = getNewId("intake");

  return {
    ...preReqRes.env,
    ids: {
      ...preReqRes.env.ids,
      proposalId,
      intakeId,
    },
    stages: {
      ...preReqRes.env.stages,
      intake: {
        hasRun: true,
        ranAt,
        observed: { proposalId } as any,
        intakeId,
        proposal: {
          id: proposalId,
          createdAt: `${ranAt}`,
          actor: result.data.rawProposal.actor,
          kind: "PROPOSAL_RECORD",
          trust: "UNTRUSTED",
          proposalId,
          fingerprint: fingerprint({
            proposalId,
            actor: result.data.rawProposal.actor,
          }),
          intakeTimestamp: `${ranAt}`,
          rawProposal: result.data.rawProposal,
        },
      },
    },
  };
}
