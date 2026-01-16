import z from "zod";
// import type { CommitOutcome } from "#/types/rna/pipeline/ingestion/commit/commitDecision.constants";
import type {
  EffectDecisionModeOrUnknown,
  GuardResult,
  StageGuardTrace,
} from "#/types/rna/pipeline/pipeline.types";

import { ExecutionEffectsLogSchema } from "#/types/rna/pipeline/ingestion/execution/execution.schemas";
import {
  RevalidationCommitDirectiveSchema,
  RevalidationInputSchema,
} from "./revalidation.schemas";
import type { RevalidationRule } from "./revalidation.rules";

export type AllowedModes = ["FULL"] | ["FULL", "PARTIAL"];

export type CommitPolicy = {
  allowedModes: AllowedModes;
};

export type RevalidationCommitDirective = z.infer<
  typeof RevalidationCommitDirectiveSchema
>;

export type RevalidationInput = z.infer<typeof RevalidationInputSchema>;

type EffectsLog = z.infer<typeof ExecutionEffectsLogSchema>;

export type RevalidationGuardOutput = {
  proposalId: string;
  directive: RevalidationCommitDirective;
  effectsLog: EffectsLog;
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
