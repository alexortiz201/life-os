import { PlanningInputSchema } from "#/types/rna/pipeline/ingestion/planning/planning.schemas";
import {
  guardFactory,
  preGuardFactory,
} from "#/rna/pipelines/pipeline-utils/guard-utils";

export const guardPlanning = guardFactory({
  STAGE: "PLANNING",
  InputSchema: PlanningInputSchema,
  code: "INVALID_PLANNING_INPUT",
  parseFailedRule: "PARSE_FAILED",
});

export const guardPrePlanning = preGuardFactory({
  STAGE: "PLANNING",
  CODE: "PLANNING_PREREQ_MISSING",
} as const);
