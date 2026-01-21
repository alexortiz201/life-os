import { guardFactory } from "#/rna/pipelines/pipeline-utils/guard-utils";
import { preGuardFactory } from "#/rna/pipelines/pipeline-utils/preguard-utils";

import { IntakeInputSchema } from "#/types/rna/pipeline/ingestion/intake/intake.schemas";
import { IntakeEnvelope } from "#/types/rna/pipeline/ingestion/intake/intake.types";
import type { SchemaParseParams } from "#/types/rna/pipeline/pipeline-utils/guard-utils.types";

export const guardPreIntake = preGuardFactory({
  STAGE: "INTAKE" as const,
  CODE: "INTAKE_PREREQ_MISSING" as const,
} as const);

const pluckParams = ({
  env,
  ids,
  stages,
  proposalId,
}: SchemaParseParams<IntakeEnvelope>) => ({
  proposalId,
  ids,
  rawProposal: env.rawProposal,
  // context: env.context,
});

export const guardIntake = guardFactory({
  STAGE: "INTAKE",
  InputSchema: IntakeInputSchema,
  code: "INVALID_INTAKE_INPUT" as const,
  parseFailedRule: "PARSE_FAILED" as const,
  pluckParams,
});
