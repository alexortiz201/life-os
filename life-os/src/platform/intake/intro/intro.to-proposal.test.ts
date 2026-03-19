import { describe, expect, it } from "vitest"

import { introExtractionToRawProposal } from "./intro.to-proposal"
import type { IntroExtraction } from "./intro-extraction.types"

describe("introExtractionToRawProposal", () => {
  it("preserves the message, extraction, and caller-provided proposal fields", () => {
    const intent = "intro.intake"
    const message =
      "I want to improve my mornings but I work weekdays and prefer direct accountability"
    const actorId = "alex"
    const entity = "intro"
    const impact = "LOW" as const
    const reversibilityClaim = "REVERSIBLE" as const
    const role = "coach"
    const selector = "user:alex"

    const extraction: IntroExtraction = {
      summary: message,
      goals: ["improve mornings"],
      constraints: ["works weekdays"],
      preferences: ["direct accountability"],
      missingInfo: ["sleep schedule"],
      suggestedNextQuestions: ["What time do you usually wake up?"],
      status: "CONTINUE",
    }

    const result = introExtractionToRawProposal({
      intent,
      message,
      extraction,
      actorId,
      entity,
      impact,
      reversibilityClaim,
      role,
      selector,
    })

    expect(result.intent).toBe(intent)

    expect(result.actor).toEqual({
      actorId,
      actorType: "USER",
      role,
    })

    expect(result.target).toEqual({
      entity,
      scope: {
        allowedKinds: ["NOTE"],
      },
      selector,
    })

    expect(result.dependencies).toEqual([])
    expect(result.impact).toBe(impact)
    expect(result.reversibilityClaim).toBe(reversibilityClaim)

    expect(result.payload).toEqual({
      message,
      extraction,
    })
  })
})