import z from "zod";

import type {
  EffectDecisionModeOrUnknown,
  GuardResult,
  StageGuardTrace,
} from "#/platform/pipeline/pipeline.types";

import { ExecutionEffectsLog } from "#/rna/pipeline/ingestion/stages/execution/execution.types";
import {
  RevalidationCommitDirectiveSchema,
  RevalidationInputSchema,
} from "./revalidation.schemas";
import type { RevalidationRule } from "./revalidation.rules";

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
