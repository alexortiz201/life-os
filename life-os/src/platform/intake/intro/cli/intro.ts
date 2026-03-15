import { IntakeRawProposalSchema } from "#/rna/pipeline/ingestion/stages/intake/intake.schemas"
import type { IntakeRawProposal } from "#/rna/pipeline/ingestion/stages/intake/intake.types"

import { mockExtractIntro } from "../intro.mock-ai"
import { introExtractionToRawProposal } from "../intro.to-proposal"

type CliArgs = {
  intent: string
  message: string
  actorId: string
  entity: string
  impact: "LOW" | "MED" | "HIGH"
  reversibilityClaim: "REVERSIBLE" | "PARTIALLY_REVERSIBLE" | "IRREVERSIBLE"
  selector?: string
  role?: string
}

export const parseCliArgs = (argv: string[]): CliArgs => {
  const get = (flag: string) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }

  const intent = get("--intent")
  const message = get("--message")
  const actorId = get("--actor-id")
  const entity = get("--entity")
  const impact = get("--impact")
  const reversibilityClaim = get("--reversibility")
  const selector = get("--selector")
  const role = get("--role")

  if (!intent) throw new Error("Missing --intent")
  if (!message) throw new Error("Missing --message")
  if (!actorId) throw new Error("Missing --actor-id")
  if (!entity) throw new Error("Missing --entity")
  if (!impact) throw new Error("Missing --impact")
  if (!reversibilityClaim) throw new Error("Missing --reversibility")

  return {
    intent,
    message,
    actorId,
    entity,
    impact: impact as CliArgs["impact"],
    reversibilityClaim: reversibilityClaim as CliArgs["reversibilityClaim"],
    selector,
    role,
  }
}

export const cliArgsToRawProposal = (input: CliArgs): IntakeRawProposal => {
  const extraction = mockExtractIntro(input.message)

  return introExtractionToRawProposal({
    intent: input.intent,
    message: input.message,
    extraction,
    actorId: input.actorId,
    entity: input.entity,
    impact: input.impact,
    reversibilityClaim: input.reversibilityClaim,
    role: input.role,
    selector: input.selector,
  })
}

export const parseCliRawProposal = (argv: string[]): IntakeRawProposal => {
  const args = parseCliArgs(argv)
  return cliArgsToRawProposal(args)
}