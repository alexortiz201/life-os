import { z } from "zod";

import { ExecutionEffectsLogSchema } from "./execution.schemas";

export type ExecutionEffectsLog = z.infer<typeof ExecutionEffectsLogSchema>;

export type GuardExecutionResult = any;
export type ExecutionTrace = any;
