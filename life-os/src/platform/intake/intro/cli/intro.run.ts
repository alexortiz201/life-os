/* EXAMPLE USAGE:
  npx tsx intro.run.ts "I want to improve my mornings but I work weekdays and prefer direct accountability"
*/
import * as E from "fp-ts/Either"

import { makeIngestionEnvelope } from "#/rna/pipeline/ingestion/ingestion.factory"
import { intakeStage } from "#/rna/pipeline/ingestion/stages/intake/intake.stage"

import { mockExtractIntro } from "../ai/intro.mock-ai"
import { extractIntroWithAI } from "../ai/intro.ai"
import { introExtractionToRawProposal } from "../intro.to-proposal"
import { createGetCliArg } from "./intro"

const main = async () => {
  const get = createGetCliArg(process.argv.slice(2))
  const message = get('--message')
  const useAi = get('--useAi') === 'true'

  if (!message) throw new Error("Missing message")
  if (useAi) console.log("***Through the wire, AI...***")

  const { ok, data: extraction } = useAi ? await extractIntroWithAI(message) : mockExtractIntro(message)

  if (!ok) throw new Error('Error extracting intro')

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

  console.log(JSON.stringify({ extraction, intake: result.right.stages.intake }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})