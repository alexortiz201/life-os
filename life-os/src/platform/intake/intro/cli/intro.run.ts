/* EXAMPLE USAGE:
  npx tsx intro.run.ts "I want to improve my mornings but I work weekdays and prefer direct accountability"
*/
import * as E from "fp-ts/Either"

import { makeIngestionEnvelope } from "#/rna/pipeline/ingestion/ingestion.factory"
import { intakeStage } from "#/rna/pipeline/ingestion/stages/intake/intake.stage"

import { mockExtractIntro } from "../intro.mock-ai"
import { introExtractionToRawProposal } from "../intro.to-proposal"

const main = () => {
  const message = process.argv.slice(2).join(" ").trim()

  if (!message) {
    throw new Error("Missing intro message")
  }

  const extraction = mockExtractIntro(message)

  const rawProposal = introExtractionToRawProposal({
    intent: "intro.intake",
    message,
    extraction,
    actorId: "cli-user",
    entity: "intro",
    impact: "LOW",
    reversibilityClaim: "REVERSIBLE",
  })

  const env = makeIngestionEnvelope(rawProposal)
  const result = intakeStage(env)

  if (E.isLeft(result)) {
    console.error(JSON.stringify(result.left, null, 2))
    process.exit(1)
  }

  console.log(
    JSON.stringify(
      {
        extraction,
        intake: result.right.stages.intake,
      },
      null,
      2
    )
  )
}

main()