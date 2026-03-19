import { z } from "zod"

export const IntroStatusSchema = z.enum([
  "CONTINUE",
  "READY_FOR_PLANNING",
])

export const IntroExtractionSchema = z.object({
  summary: z.string(),
  goals: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  preferences: z.array(z.string()).default([]),
  missingInfo: z.array(z.string()).default([]),
  suggestedNextQuestions: z.array(z.string()).default([]),
  status: IntroStatusSchema,
})
