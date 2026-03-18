import { extractText } from "./intro.ai"
import { IntroExtractionSchema, type IntroExtraction } from "../intro-extraction.schemas"
import { mockIntroResponse } from "./mocks"

export const mockExtractIntro = (message: string): {
    ok: true,
    data: IntroExtraction,
    error: undefined,
  } => {
  const response = mockIntroResponse
  const text = extractText(response)
  const parsed = JSON.parse(text)

  return {
    ok: true as const,
    data: IntroExtractionSchema.parse(parsed),
    error: undefined,
  }
}

// Should yield something with this structure:
// ({
//   summary: message,
//   goals: ["improve mornings"],
//   constraints: ["works weekdays"],
//   preferences: ["direct accountability"],
//   missingInfo: ["sleep schedule"],
//   suggestedNextQuestions: ["What time do you usually wake up?"],
//   status: "CONTINUE",
// })