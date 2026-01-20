import { getContextSnapshot } from "#/domain/snapshot/snapshot.provider";

import { guardFactory } from "#/rna/pipelines/pipeline-utils/guard-utils";
import { preGuardFactory } from "#/rna/pipelines/pipeline-utils/preguard-utils";

import { ValidationInputSchema } from "#/types/rna/pipeline/ingestion/validation/validation.schemas";
import type { SchemaParseParams } from "#/types/rna/pipeline/pipeline-utils/guard-utils.types";

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
