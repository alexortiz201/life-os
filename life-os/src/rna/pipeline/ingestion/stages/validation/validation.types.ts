import { z } from "zod";

import { ValidationSchema } from "./validation.schemas";

export type Validation = z.infer<typeof ValidationSchema>;

export type GuardValidationResult = any;
export type ValidationTrace = any;

export type AllowedModes = ["FULL"] | ["FULL", "PARTIAL"];
export type DecisionType = "APPROVE" | "REJECT" | "PARTIAL_APPROVE" | "ESCALATE";

export type CommitPolicy = {
  allowedModes: AllowedModes;
};
