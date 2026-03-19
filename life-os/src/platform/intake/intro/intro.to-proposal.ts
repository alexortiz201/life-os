import type { IntakeRawProposal } from "#/rna/pipeline/ingestion/stages/intake/intake.types"
import type { IntroExtraction } from "./intro-extraction.types"

type IntroExtractionToRawProposalInput = {
  intent: string
  message: string
  extraction: IntroExtraction
  actorId: string
  entity: string
  impact: "LOW" | "MED" | "HIGH"
  reversibilityClaim: "REVERSIBLE" | "PARTIALLY_REVERSIBLE" | "IRREVERSIBLE"
  role?: string
  selector?: string
}

export const introExtractionToRawProposal = ({
  intent,
  message,
  extraction,
  actorId,
  entity,
  impact,
  reversibilityClaim,
  role,
  selector,
}: IntroExtractionToRawProposalInput): IntakeRawProposal => ({
  intent,
  actor: {
    actorId,
    actorType: "USER",
    role,
  },
  target: {
    entity,
    scope: {
      allowedKinds: ["NOTE"],
    },
    selector,
  },
  dependencies: [],
  impact,
  reversibilityClaim,
  payload: {
    message,
    extraction,
  },
})