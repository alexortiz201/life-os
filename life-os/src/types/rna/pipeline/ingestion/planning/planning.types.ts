import { z } from "zod";

import { PlanningSchema } from "./planning.schemas";

export type Planning = z.infer<typeof PlanningSchema>;

export type GuardPlanningResult = any;
export type PlanningTrace = any;
