import { z } from "zod";
import { PIPELINE_STAGES } from "./pipeline.constants";

export const PipelineStageSchema = z.enum(PIPELINE_STAGES);
