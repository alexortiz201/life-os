import z from "zod";
import { TrustLevelSchema } from "./trust.schemas";

export type TrustLevel = z.infer<typeof TrustLevelSchema>;
