import { z } from "zod";
import { TRUST_LEVELS } from "./constants";

export const TrustLevelSchema = z.enum(TRUST_LEVELS);
export type { TrustLevel } from "./constants";
