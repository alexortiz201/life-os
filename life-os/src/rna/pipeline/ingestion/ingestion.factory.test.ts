import { describe, it, expect } from "vitest"

import {
  makeDefaultIngestionSnapshot,
  makeIngestionEnvelope,
} from "./ingestion.factory"

import type { IntakeRawProposal } from "./stages/intake/intake.types"

const mockRawProposal: IntakeRawProposal = {
  intent: "intro.intake",
  actor: {
    actorId: "alex",
    actorType: "USER",
  },
  target: {
    entity: "intro",
    scope: {
      allowedKinds: ["NOTE"],
    },
  },
  dependencies: [],
  impact: "LOW",
  reversibilityClaim: "REVERSIBLE",
}

describe("ingestion.factory", () => {
  describe("makeDefaultIngestionSnapshot", () => {
    it("creates a valid snapshot from a raw proposal", () => {
      const snapshot = makeDefaultIngestionSnapshot(mockRawProposal)

      expect(snapshot.permissions.actor.actorId).toBe("alex")
      expect(snapshot.permissions.actor.actorType).toBe("USER")

      expect(snapshot.permissions.allow).toContain("WEEKLY_REFLECTION")

      expect(snapshot.scope.allowedKinds).toContain("NOTE")

      expect(snapshot.invariantsVersion).toBeTruthy()
      expect(typeof snapshot.timestampMs).toBe("number")
    })
  })

  describe("makeIngestionEnvelope", () => {
    it("creates a valid ingestion envelope", () => {
      const env = makeIngestionEnvelope(mockRawProposal)

      expect(env.snapshot).toBeTruthy()
      expect(env.ids).toBeTruthy()
      expect(env.ids.proposalId).toBeTruthy()
      expect(env.ids.snapshotId).toBeTruthy()

      expect(env.rawProposal.intent).toBe("intro.intake")

      expect(env.stages.intake.hasRun).toBe(false)
      expect(env.stages.validation.hasRun).toBe(false)
      expect(env.stages.planning.hasRun).toBe(false)
      expect(env.stages.execution.hasRun).toBe(false)
      expect(env.stages.revalidation.hasRun).toBe(false)
      expect(env.stages.commit.hasRun).toBe(false)

      expect(env.errors).toEqual([])
    })

    it("propagates actor permissions from the proposal", () => {
      const env = makeIngestionEnvelope(mockRawProposal)

      expect(env.snapshot.permissions.actor.actorId).toBe("alex")
      expect(env.snapshot.permissions.actor.actorType).toBe("USER")
    })
  })
})