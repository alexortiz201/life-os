// src/platform/adapters/intake/intro.cli.test.ts

import { describe, expect, it } from "vitest"

import { cliArgsToRawProposal, parseCliRawProposal } from "./intro.cli"

describe("intro.cli", () => {
  describe("cliArgsToRawProposal", () => {
    it("builds a valid raw proposal from required fields", () => {
      const result = cliArgsToRawProposal({
        intent: "intro.intake",
        actorId: "alex",
        entity: "intro",
        impact: "LOW",
        reversibilityClaim: "REVERSIBLE",
      })

      expect(result.intent).toBe("intro.intake")
      expect(result.actor.actorId).toBe("alex")
      expect(result.actor.actorType).toBe("USER")
      expect(result.target.entity).toBe("intro")
      expect(result.target.scope.allowedKinds).toEqual(["NOTE"])
      expect(result.dependencies).toEqual([])
      expect(result.impact).toBe("LOW")
      expect(result.reversibilityClaim).toBe("REVERSIBLE")
    })

    it("maps optional selector and role", () => {
      const result = cliArgsToRawProposal({
        intent: "intro.intake",
        actorId: "alex",
        entity: "intro",
        impact: "MED",
        reversibilityClaim: "PARTIALLY_REVERSIBLE",
        selector: "user:alex",
        role: "coach",
      })

      expect(result.actor.role).toBe("coach")
      expect(result.target.selector).toBe("user:alex")
      expect(result.impact).toBe("MED")
      expect(result.reversibilityClaim).toBe("PARTIALLY_REVERSIBLE")
    })
  })

  describe("parseCliRawProposal", () => {
    it("parses argv into a valid raw proposal", () => {
      const argv = [
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
      ]

      const result = parseCliRawProposal(argv)

      expect(result.intent).toBe("intro.intake")
      expect(result.actor.actorId).toBe("alex")
      expect(result.actor.actorType).toBe("USER")
      expect(result.target.entity).toBe("intro")
      expect(result.target.scope.allowedKinds).toEqual(["NOTE"])
      expect(result.dependencies).toEqual([])
      expect(result.impact).toBe("LOW")
      expect(result.reversibilityClaim).toBe("REVERSIBLE")
    })

    it("parses optional flags when provided", () => {
      const argv = [
        "--intent",
        "intro.intake",
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

      expect(result.actor.role).toBe("coach")
      expect(result.target.selector).toBe("user:alex")
      expect(result.impact).toBe("HIGH")
      expect(result.reversibilityClaim).toBe("IRREVERSIBLE")
    })

    it("throws when --intent is missing", () => {
      expect(() =>
        parseCliRawProposal([
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

    it("throws when --actor-id is missing", () => {
      expect(() =>
        parseCliRawProposal([
          "--intent",
          "intro.intake",
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