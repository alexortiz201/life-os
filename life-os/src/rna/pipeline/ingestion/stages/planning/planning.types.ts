import { z } from "zod";

import { PipelineStageFn } from "#/platform/pipeline/stage/stage";
import { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";
import { PlanningSchema } from "./planning.schemas";
import { STAGE } from "./planning.const";

export type Planning = z.infer<typeof PlanningSchema>;

export type PlanningErrorCode =
  | "PLANNING_PREREQ_MISSING"
  | "INVALID_PLANNING_INPUT";

export type PlanningStage = PipelineStageFn<
  IngestionPipelineEnvelope,
  typeof STAGE,
  PlanningErrorCode
>;
