import { z } from "zod";

import { PipelineStageFn } from "#/platform/pipeline/stage/stage";
import { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";

import { EXECUTION_RULES, STAGE } from "./execution.const";
import {
  ExecutionEffectsLogSchema,
  ExecutionSchema,
} from "./execution.schemas";

export type ExecutionEffectsLog = z.infer<typeof ExecutionEffectsLogSchema>;
export type ExecutionRule = (typeof EXECUTION_RULES)[number];
export type ExecutionErrorCode =
  | "EXECUTION_PREREQ_MISSING"
  | "INVALID_EXECUTION_INPUT";

export type ExecutionStage = PipelineStageFn<
  IngestionPipelineEnvelope,
  typeof STAGE,
  ExecutionErrorCode
>;

export type Execution = z.infer<typeof ExecutionSchema>;
