import { z } from "zod";

import type { PipelineStageFn } from "#/platform/pipeline/stage/stage.types";
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";

import { CommitPolicySchema, ValidationSchema } from "./validation.schemas";
import { DECISION_TYPES, STAGE, VALIDATION_RULES } from "./validation.const";

export type Validation = z.infer<typeof ValidationSchema>;
export type CommitPolicy = z.infer<typeof CommitPolicySchema>;

export type AllowedModes = ["FULL"] | ["FULL", "PARTIAL"];
export type DecisionType = (typeof DECISION_TYPES)[number];

export type ValidationErrorCode =
  | "INVALID_VALIDATION_INPUT"
  | "VALIDATION_PREREQ_MISSING"
  | "SNAPSHOT_PERMISSION_NOT_ALLOWED";

export type ValidationRule = (typeof VALIDATION_RULES)[number];

export type ValidationStage = PipelineStageFn<
  IngestionPipelineEnvelope,
  typeof STAGE,
  ValidationErrorCode
>;
