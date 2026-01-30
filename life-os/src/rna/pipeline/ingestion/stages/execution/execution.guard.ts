import { ExecutionInputSchema } from "#/rna/pipeline/ingestion/stages/execution/execution.schemas";

import { guardFactory } from "#/platform/pipeline/guard/guard.factory";
import { preGuardFactory } from "#/platform/pipeline/preguard/preguard.factory";
import type { SchemaParseParams } from "#/platform/pipeline/guard/guard.factory.types";

export const guardPreExecution = preGuardFactory({
  STAGE: "EXECUTION",
  CODE: "EXECUTION_PREREQ_MISSING",
} as const);

const pluckParams = ({ ids, stages, proposalId }: SchemaParseParams) => {
  const validation = stages.validation;
  const planning = stages.planning;

  return {
    proposalId,
    snapshotId: ids?.snapshotId,
    validationDecision:
      (validation as any).validationId ?? "validation_unknown",
    planningId: ids?.planningId ?? "planning_unknown",
    plan: (planning as any)?.plan ?? [],
    commitPolicy: (validation as any).commitPolicy ?? undefined,
  };
};

export const guardExecution = guardFactory({
  STAGE: "EXECUTION",
  InputSchema: ExecutionInputSchema,
  code: "INVALID_EXECUTION_INPUT",
  parseFailedRule: "PARSE_FAILED",
  pluckParams,
});
