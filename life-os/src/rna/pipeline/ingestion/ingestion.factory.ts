import { getNewId } from "#/domain/identity/id.provider"
import type { IntakeRawProposal } from "./stages/intake/intake.types"
import type { IngestionContextSnapshot, IngestionPipelineEnvelope } from "./ingestion.types"

export const makeDefaultIngestionSnapshot = (
  rawProposal: IntakeRawProposal
): IngestionContextSnapshot => ({
  permissions: {
    actor: {
      actorId: rawProposal.actor.actorId,
      actorType: rawProposal.actor.actorType,
      role: rawProposal.actor.role,
    },
    allow: ["WEEKLY_REFLECTION"],
  },
  scope: {
    allowedKinds: ["NOTE"],
  },
  invariantsVersion: "v1",
  timestampMs: Date.now(),
})

export const makeIngestionEnvelope = (
	rawProposal: IntakeRawProposal,
): IngestionPipelineEnvelope & { rawProposal: IntakeRawProposal } => {
  const snapshot = makeDefaultIngestionSnapshot(rawProposal)
  return {
    ids: {
      proposalId: getNewId("proposal"),
      snapshotId: getNewId("snapshot"),
    },
    snapshot,
    errors: [],
    stages: {
      intake: { hasRun: false },
      validation: { hasRun: false },
      planning: { hasRun: false },
      execution: { hasRun: false },
      revalidation: { hasRun: false },
      commit: { hasRun: false },
    },
    rawProposal,
  }
}