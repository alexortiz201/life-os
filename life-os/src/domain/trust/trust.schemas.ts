import { z } from "zod"
import { TRUST_LEVELS } from "./trust.constants"

export const TrustLevelSchema = z.enum(TRUST_LEVELS)
