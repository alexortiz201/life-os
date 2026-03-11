/* EXAMPLE USAGE:
  npm run lifeos:intro -- \
    --intent intro.intake \
    --actor-id alex \
    --entity intro \
    --impact LOW \
    --reversibility REVERSIBLE
*/
import * as E from "fp-ts/Either"

import { intakeStage } from "#/rna/pipeline/ingestion/stages/intake/intake.stage"
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types"
import { parseCliRawProposal } from "./intro.cli"
import { makeIngestionEnvelope } from "#/rna/pipeline/ingestion/ingestion.factory"

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