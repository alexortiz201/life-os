/**
 * Example Usage:
 *  lifeos-intro \
 *  --intent "intro.intake" \
 *  --actor-id "alex" \
 *  --entity "intro" \
 *  --impact LOW \
 *  --reversibility REVERSIBLE
 *
 *  Optional:
 *    •	--selector
 *    •	--role
 */
import { IntakeRawProposalSchema } from "#/rna/pipeline/ingestion/stages/intake/intake.schemas"
import type { IntakeRawProposal } from "#/rna/pipeline/ingestion/stages/intake/intake.types"

type CliArgs = {
  intent: string
  actorId: string
  entity: string
  impact: "LOW" | "MED" | "HIGH"
  reversibilityClaim: "REVERSIBLE" | "PARTIALLY_REVERSIBLE" | "IRREVERSIBLE"
  selector?: string
  role?: string
}

const parseArgs = (argv: string[]): CliArgs => {
  const get = (flag: string) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }

  const intent = get("--intent")
  const actorId = get("--actor-id")
  const entity = get("--entity")
  const impact = get("--impact")
  const reversibilityClaim = get("--reversibility")
  const selector = get("--selector")
  const role = get("--role")

  if (!intent) throw new Error("Missing --intent")
  if (!actorId) throw new Error("Missing --actor-id")
  if (!entity) throw new Error("Missing --entity")
  if (!impact) throw new Error("Missing --impact")
  if (!reversibilityClaim) throw new Error("Missing --reversibility")

  return {
    intent,
    actorId,
    entity,
    impact: impact as CliArgs["impact"],
    reversibilityClaim: reversibilityClaim as CliArgs["reversibilityClaim"],
    selector,
    role,
  }
}

export const cliArgsToRawProposal = (input: CliArgs): IntakeRawProposal =>
  IntakeRawProposalSchema.parse({
    intent: input.intent,
    actor: {
      actorId: input.actorId,
      actorType: "USER",
      role: input.role,
    },
    target: {
      entity: input.entity,
      scope: {
        allowedKinds: ["NOTE"],
      },
      selector: input.selector,
    },
    dependencies: [],
    impact: input.impact,
    reversibilityClaim: input.reversibilityClaim,
  })

export const parseCliRawProposal = (argv: string[]): IntakeRawProposal => {
  const args = parseArgs(argv)
  return cliArgsToRawProposal(args)
}