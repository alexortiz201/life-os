import { describe, expect, it } from "vitest"

import { cliArgsToRawProposal, parseCliRawProposal } from "./intro"

describe("intro.cli", () => {
  describe("cliArgsToRawProposal", () => {
    it("builds a valid raw proposal from a message", () => {
      const message = "I want to improve my mornings"

      const result = cliArgsToRawProposal({
        intent: "intro.intake",
        message,
        actorId: "alex",
        entity: "intro",
        impact: "LOW",
        reversibilityClaim: "REVERSIBLE",
      })

      expect(result.intent).toBe("intro.intake")

      expect(result.actor).toEqual({
        actorId: "alex",
        actorType: "USER",
        role: undefined,
      })

      expect(result.target).toEqual({
        entity: "intro",
        scope: {
          allowedKinds: ["NOTE"],
        },
        selector: undefined,
      })

      expect(result.dependencies).toEqual([])
      expect(result.impact).toBe("LOW")
      expect(result.reversibilityClaim).toBe("REVERSIBLE")

      expect(result.payload.message).toBe(message)
      expect(result.payload.extraction.summary).toBe(message)
      expect(result.payload.extraction.goals).toEqual(["improve mornings"])
      expect(result.payload.extraction.constraints).toEqual(["works weekdays"])
      expect(result.payload.extraction.preferences).toEqual([
        "direct accountability",
      ])
      expect(result.payload.extraction.missingInfo).toEqual(["sleep schedule"])
      expect(result.payload.extraction.suggestedNextQuestions).toEqual([
        "What time do you usually wake up?",
      ])
      expect(result.payload.extraction.status).toBe("CONTINUE")
    })

    it("maps optional selector and role when provided", () => {
      const message = "I want to improve my mornings"

      const result = cliArgsToRawProposal({
        intent: "intro.intake",
        message,
        actorId: "alex",
        entity: "intro",
        impact: "MED",
        reversibilityClaim: "PARTIALLY_REVERSIBLE",
        selector: "user:alex",
        role: "coach",
      })

      expect(result.actor).toEqual({
        actorId: "alex",
        actorType: "USER",
        role: "coach",
      })

      expect(result.target).toEqual({
        entity: "intro",
        scope: {
          allowedKinds: ["NOTE"],
        },
        selector: "user:alex",
      })

      expect(result.impact).toBe("MED")
      expect(result.reversibilityClaim).toBe("PARTIALLY_REVERSIBLE")

      expect(result.payload.message).toBe(message)
      expect(result.payload.extraction.status).toBe("CONTINUE")
    })
  })

  describe("parseCliRawProposal", () => {
    it("parses argv into a valid raw proposal", () => {
      const message = "I want to improve my mornings"

      const argv = [
        "--intent",
        "intro.intake",
        "--message",
        message,
        "--actor-id",
        "alex",
        "--entity",
        "intro",
        "--impact",
        "LOW",
        "--reversibility",
        "REVERSIBLE",
      ]

      const result = parseCliRawProposal(argv)

      expect(result.intent).toBe("intro.intake")

      expect(result.actor).toEqual({
        actorId: "alex",
        actorType: "USER",
        role: undefined,
      })

      expect(result.target).toEqual({
        entity: "intro",
        scope: {
          allowedKinds: ["NOTE"],
        },
        selector: undefined,
      })

      expect(result.dependencies).toEqual([])
      expect(result.impact).toBe("LOW")
      expect(result.reversibilityClaim).toBe("REVERSIBLE")

      expect(result.payload.message).toBe(message)
      expect(result.payload.extraction.summary).toBe(message)
      expect(result.payload.extraction.status).toBe("CONTINUE")
    })

    it("parses optional flags when provided", () => {
      const message = "I want to improve my mornings"

      const argv = [
        "--intent",
        "intro.intake",
        "--message",
        message,
        "--actor-id",
        "alex",
        "--entity",
        "intro",
        "--impact",
        "HIGH",
        "--reversibility",
        "IRREVERSIBLE",
        "--selector",
        "user:alex",
        "--role",
        "coach",
      ]

      const result = parseCliRawProposal(argv)

      expect(result.actor).toEqual({
        actorId: "alex",
        actorType: "USER",
        role: "coach",
      })

      expect(result.target).toEqual({
        entity: "intro",
        scope: {
          allowedKinds: ["NOTE"],
        },
        selector: "user:alex",
      })

      expect(result.impact).toBe("HIGH")
      expect(result.reversibilityClaim).toBe("IRREVERSIBLE")

      expect(result.payload.message).toBe(message)
      expect(result.payload.extraction.summary).toBe(message)
      expect(result.payload.extraction.status).toBe("CONTINUE")
    })

    it("throws when --intent is missing", () => {
      expect(() =>
        parseCliRawProposal([
          "--message",
          "test message",
          "--actor-id",
          "alex",
          "--entity",
          "intro",
          "--impact",
          "LOW",
          "--reversibility",
          "REVERSIBLE",
        ])
      ).toThrow("Missing --intent")
    })

    it("throws when --message is missing", () => {
      expect(() =>
        parseCliRawProposal([
          "--intent",
          "intro.intake",
          "--actor-id",
          "alex",
          "--entity",
          "intro",
          "--impact",
          "LOW",
          "--reversibility",
          "REVERSIBLE",
        ])
      ).toThrow("Missing --message")
    })

    it("throws when --actor-id is missing", () => {
      expect(() =>
        parseCliRawProposal([
          "--intent",
          "intro.intake",
          "--message",
          "test message",
          "--entity",
          "intro",
          "--impact",
          "LOW",
          "--reversibility",
          "REVERSIBLE",
        ])
      ).toThrow("Missing --actor-id")
    })

    it("throws when --entity is missing", () => {
      expect(() =>
        parseCliRawProposal([
          "--intent",
          "intro.intake",
          "--message",
          "test message",
          "--actor-id",
          "alex",
          "--impact",
          "LOW",
          "--reversibility",
          "REVERSIBLE",
        ])
      ).toThrow("Missing --entity")
    })

    it("throws when --impact is missing", () => {
      expect(() =>
        parseCliRawProposal([
          "--intent",
          "intro.intake",
          "--message",
          "test message",
          "--actor-id",
          "alex",
          "--entity",
          "intro",
          "--reversibility",
          "REVERSIBLE",
        ])
      ).toThrow("Missing --impact")
    })

    it("throws when --reversibility is missing", () => {
      expect(() =>
        parseCliRawProposal([
          "--intent",
          "intro.intake",
          "--message",
          "test message",
          "--actor-id",
          "alex",
          "--entity",
          "intro",
          "--impact",
          "LOW",
        ])
      ).toThrow("Missing --reversibility")
    })
  })
})