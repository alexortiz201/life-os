import { ValidationInputSchema } from "#/types/rna/pipeline/ingestion/validation/validation.schemas";
import {
  CandidateInput,
  guardFactory,
  preGuardFactory,
} from "#/rna/pipelines/pipeline-utils/guard-utils";
import { getContextSnapshot } from "#/domain/snapshot/snapshot.provider";

export const guardPreValidation = preGuardFactory({
  STAGE: "VALIDATION",
  CODE: "VALIDATION_PREREQ_MISSING",
} as const);

const getCandidate = ({ ids, stages, proposalId }: CandidateInput) => ({
  proposalId,
  snapshotId: ids?.snapshotId,
  snapshot: getContextSnapshot(),
  // validationDecision:
  //   (stages.validation as any).validationId ?? "validation_unknown",
  // commitPolicy: (stages.validation as any).commitPolicy ?? undefined,
});

export const guardValidation = guardFactory({
  STAGE: "VALIDATION",
  InputSchema: ValidationInputSchema,
  code: "INVALID_VALIDATION_INPUT",
  parseFailedRule: "PARSE_FAILED",
  getCandidate,
});
