import { z } from "zod";

import { ExecutionEffectsLogSchema } from "./execution.schemas";

export type ExecutionEffectsLog = z.infer<typeof ExecutionEffectsLogSchema>;
