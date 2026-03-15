import type { IntroExtraction } from "./intro-extraction.schemas"

export const mockExtractIntro = (message: string): IntroExtraction => ({
  summary: message,
  goals: ["improve mornings"],
  constraints: ["works weekdays"],
  preferences: ["direct accountability"],
  missingInfo: ["sleep schedule"],
  suggestedNextQuestions: ["What time do you usually wake up?"],
  status: "CONTINUE",
})