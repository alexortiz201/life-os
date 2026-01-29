import { z } from "zod";

import { ValidationSchema } from "./validation.schemas";
import { DECISION_TYPES, VALIDATION_RULES } from "./validation.const";

export type Validation = z.infer<typeof ValidationSchema>;

export type AllowedModes = ["FULL"] | ["FULL", "PARTIAL"];
export type DecisionType = (typeof DECISION_TYPES)[number];

export type CommitPolicy = {
  allowedModes: AllowedModes;
};

export type ValidationErrorCode =
  | "INVALID_VALIDATION_INPUT"
  | "VALIDATION_PREREQ_MISSING"
  | "SNAPSHOT_PERMISSION_NOT_ALLOWED";

export type ValidationRule = (typeof VALIDATION_RULES)[number];
