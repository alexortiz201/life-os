import { getContextSnapshot } from "#/domain/snapshot/snapshot.provider";

import { guardFactory } from "#/platform/pipeline/guard/guard.factory";
import { preGuardFactory } from "#/platform/pipeline/preguard/preguard.factory";

import { ValidationInputSchema } from "#/rna/pipeline/ingestion/validation/validation.schemas";
import type { SchemaParseParams } from "#/rna/pipeline/pipeline-utils/guard-utils.types";

export const guardPreValidation = preGuardFactory({
  STAGE: "VALIDATION",
  CODE: "VALIDATION_PREREQ_MISSING",
} as const);

const pluckParams = ({ env, ids, stages, proposalId }: SchemaParseParams) => ({
  proposalId,
  snapshotId: ids?.snapshotId,
  snapshot: getContextSnapshot(env),
  // validationDecision:
  //   (stages.validation as any).validationId ?? "validation_unknown",
  // commitPolicy: (stages.validation as any).commitPolicy ?? undefined,
});

export const guardValidation = guardFactory({
  STAGE: "VALIDATION",
  InputSchema: ValidationInputSchema,
  code: "INVALID_VALIDATION_INPUT",
  parseFailedRule: "PARSE_FAILED",
  pluckParams,
});
