import { guardFactory } from "#/platform/pipeline/guard/guard.factory";
import { preGuardFactory } from "#/platform/pipeline/preguard/preguard.factory";

import { IntakeInputSchema } from "#/rna/pipeline/ingestion/stages/intake/intake.schemas";
import { IntakeEnvelope } from "#/rna/pipeline/ingestion/stages/intake/intake.types";
import type { SchemaParseParams } from "#/platform/pipeline/guard/guard.factory.types";

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
