import { z } from "zod"

import { IntroExtractionSchema, IntroStatusSchema } from "./intro-extraction.schemas"

export type IntroExtraction = z.infer<typeof IntroExtractionSchema>
export type IntroStatus = z.infer<typeof IntroStatusSchema>