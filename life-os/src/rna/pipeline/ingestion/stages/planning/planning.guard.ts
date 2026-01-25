import { guardFactory } from "#/platform/pipeline/guard/guard.factory";
import { preGuardFactory } from "#/platform/pipeline/preguard/preguard.factory";

import { PlanningInputSchema } from "#/rna/pipeline/ingestion/stages/planning/planning.schemas";
import type { SchemaParseParams } from "#/platform/pipeline/guard/guard.factory.types";

export const guardPrePlanning = preGuardFactory({
  STAGE: "PLANNING",
  CODE: "PLANNING_PREREQ_MISSING",
} as const);

const pluckParams = ({ ids, stages, proposalId }: SchemaParseParams) => {
  const validation = stages.validation;
  const planning = stages.validation;

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

export const guardPlanning = guardFactory({
  STAGE: "PLANNING",
  InputSchema: PlanningInputSchema,
  code: "INVALID_PLANNING_INPUT",
  parseFailedRule: "PARSE_FAILED",
  pluckParams,
});
