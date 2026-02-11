import z from "zod";

import type {
  EffectDecisionModeOrUnknown,
  GuardResult,
  StageGuardTrace,
} from "#/platform/pipeline/pipeline.types";
import type { PipelineStageFn } from "#/platform/pipeline/stage/stage.types";

import type { ExecutionEffectsLog } from "#/rna/pipeline/ingestion/stages/execution/execution.types";
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";

import type { REVALIDATION_RULES, STAGE } from "./revalidation.const";
import {
  RevalidationCommitDirectiveSchema,
  RevalidationInputSchema,
  RevalidationSchema,
} from "./revalidation.schemas";

export type RevalidationCommitDirective = z.infer<
  typeof RevalidationCommitDirectiveSchema
>;

export type RevalidationInput = z.infer<typeof RevalidationInputSchema>;

export type RevalidationGuardOutput = {
  proposalId: string;
  directive: RevalidationCommitDirective;
  effectsLog: ExecutionEffectsLog;
};

export type RevalidationTrace = StageGuardTrace<
  EffectDecisionModeOrUnknown,
  RevalidationRule
> &
  Partial<{
    effectsLogDeclaredProposalId: string;
    effectsLogId: string;
    allowListCount: number;
  }>;

export type GuardRevalidationResult = GuardResult<
  RevalidationGuardOutput,
  RevalidationTrace
>;

export type RevalidationErrorCode =
  | "REVALIDATION_PREREQ_MISSING"
  | "INVALID_REVALIDATION_INPUT";

export type RevalidationStage = PipelineStageFn<
  IngestionPipelineEnvelope,
  typeof STAGE,
  RevalidationErrorCode
>;

export type RevalidationRule = (typeof REVALIDATION_RULES)[number];

export type Revalidation = z.infer<typeof RevalidationSchema>;
export type PostGuardRevalidationInput = {
  env: IngestionPipelineEnvelope;
  data: RevalidationInput;
};
