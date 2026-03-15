/* EXAMPLE USAGE:
  npx tsx src/platform/intake/intro/cli/intro.cli.run.ts \
    --intent intro.intake \
    --message "I want to improve my mornings but I work weekdays" \
    --actor-id alex \
    --entity intro \
    --impact LOW \
    --reversibility REVERSIBLE
*/
import * as E from "fp-ts/Either"

import { makeIngestionEnvelope } from "#/rna/pipeline/ingestion/ingestion.factory"
import { intakeStage } from "#/rna/pipeline/ingestion/stages/intake/intake.stage"

import { parseCliRawProposal } from "./intro"

const main = () => {
  const rawProposal = parseCliRawProposal(process.argv.slice(2))
  const env = makeIngestionEnvelope(rawProposal)
  const result = intakeStage(env)

  if (E.isLeft(result)) {
    console.error(JSON.stringify(result.left, null, 2))
    process.exit(1)
  }

  console.log(JSON.stringify(result.right.stages.intake, null, 2))
}

main()