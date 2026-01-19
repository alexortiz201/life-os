import { ValidationInputSchema } from "#/types/rna/pipeline/ingestion/validation/validation.schemas";
import {
  CandidateInput,
  guardFactory,
  preGuardFactory,
} from "#/rna/pipelines/pipeline-utils/guard-utils";
import { getContextSnapshot } from "#/domain/snapshot/snapshot.provider";

export const guardPreIntake = preGuardFactory({
  STAGE: "INTAKE",
  CODE: "INTAKE_PREREQ_MISSING",
} as const);

const getCandidate = ({ ids, stages, proposalId }: CandidateInput) => ({
  proposalId,
  snapshotId: ids?.snapshotId,
  snapshot: getContextSnapshot(),
  // validationDecision:
  //   (stages.validation as any).validationId ?? "validation_unknown",
  // commitPolicy: (stages.validation as any).commitPolicy ?? undefined,
});

export const guardIntake = guardFactory({
  STAGE: "INTAKE",
  InputSchema: ValidationInputSchema,
  code: "INVALID_INTAKE_INPUT",
  parseFailedRule: "PARSE_FAILED",
  getCandidate,
});
