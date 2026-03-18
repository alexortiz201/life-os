import { describe, expect, it } from "vitest"

import { extractText } from "./intro.ai"
import { mockIntroResponse, mockPayloadV1, mockPayloadV2 } from "./mocks"

describe("extractText", () => {
  it("strips markdown json fences from a Responses API output_text payload", () => {
    const text = extractText(mockIntroResponse)

    expect(text.startsWith("```")).toBe(false)
    expect(text.endsWith("```")).toBe(false)

    const parsed = JSON.parse(text)

    expect(parsed.summary).toBe(
      mockPayloadV2.payload.extraction.summary
    )
    expect(parsed.goals).toEqual(
      mockPayloadV2.payload.extraction.goals
    )
    expect(parsed.constraints).toEqual(
      mockPayloadV2.payload.extraction.constraints
    )
    expect(parsed.preferences).toEqual(
      mockPayloadV2.payload.extraction.preferences
    )
    expect(parsed.missingInfo).toEqual(
      mockPayloadV2.payload.extraction.missingInfo
    )
    expect(parsed.suggestedNextQuestions).toEqual(
      mockPayloadV2.payload.extraction.suggestedNextQuestions
    )
    expect(parsed.status).toBe(
      mockPayloadV2.payload.extraction.status
    )
  })

  it("returns plain json text unchanged when no code fences are present", () => {
    const response = {
      output_text: JSON.stringify(mockPayloadV1.payload.extraction),
    }

    const text = extractText(response)
    const parsed = JSON.parse(text)

    expect(parsed).toEqual(mockPayloadV1.payload.extraction)
  })

  it("strips generic code fences when the model returns ``` instead of ```json", () => {
    const response = {
      output_text: `\`\`\`
${JSON.stringify(mockPayloadV1.payload.extraction, null, 2)}
\`\`\``,
    }

    const text = extractText(response)
    const parsed = JSON.parse(text)

    expect(parsed).toEqual(mockPayloadV1.payload.extraction)
  })

  it("throws when output_text is missing", () => {
    expect(() => extractText({})).toThrow("Missing response.output_text")
    expect(() => extractText(null)).toThrow("Missing response.output_text")
    expect(() => extractText(undefined)).toThrow("Missing response.output_text")
  })
})

it("returns cleaned text that still fails JSON.parse when the model output is invalid json", () => {
  const response = {
    output_text: `\`\`\`json
{
  "summary": "bad json",
  "goals": ["one",],
  "status": "CONTINUE"
}
\`\`\``,
  }

  const text = extractText(response)

  expect(() => JSON.parse(text)).toThrow()
})