import { PlanningInputSchema } from "#/types/rna/pipeline/ingestion/planning/planning.schemas";
import {
  CandidateInput,
  guardFactory,
  preGuardFactory,
} from "#/rna/pipelines/pipeline-utils/guard-utils";

export const guardPrePlanning = preGuardFactory({
  STAGE: "PLANNING",
  CODE: "PLANNING_PREREQ_MISSING",
} as const);

const getCandidate = ({ ids, stages, proposalId }: CandidateInput) => {
  const validation = stages.validation;
  const planning = stages.validation;
  const commitPolicy = (validation as any).commitPolicy ?? undefined;

  return {
    proposalId,
    snapshotId: ids?.snapshotId,
    validationDecision:
      (validation as any).validationId ?? "validation_unknown",
    planningId: ids?.planningId ?? "planning_unknown",
    plan: (planning as any)?.plan ?? [],
    commitPolicy,
  };
};

export const guardPlanning = guardFactory({
  STAGE: "PLANNING",
  InputSchema: PlanningInputSchema,
  code: "INVALID_PLANNING_INPUT",
  parseFailedRule: "PARSE_FAILED",
  getCandidate,
});
