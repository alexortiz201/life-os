import z from "zod";

import { CommitOutcome } from "#types/rna/pipeline/ingestion/commit/commitDecision.constants";
import { ExecutionEffectsLogSchema } from "#types/rna/pipeline/ingestion/execution/execution.schemas";
import {
  EffectDecisionModeOrUnknown,
  GuardResult,
  StageGuardTrace,
} from "#types/rna/pipeline/pipeline.types";

import { RevalidationCommitDirectiveSchema } from "./revalidation.schemas";
import { RevalidationRule } from "./revalidation.rules";

export type AllowedModes = ["FULL"] | ["FULL", "PARTIAL"];

export type CommitPolicy = {
  allowedModes: AllowedModes;
};

export type RevalidationDecision = {
  proposalId: string;
  validationDecisionId: string;
  executionPlanId: string;
  revisionId: string;
  commitPolicy: CommitPolicy;
  outcome: CommitOutcome;
};

export type RevalidationCommitDirective = z.infer<
  typeof RevalidationCommitDirectiveSchema
>;

type EffectsLog = z.infer<typeof ExecutionEffectsLogSchema>;

export type RevalidationInput = {
  proposalId: string;
  revisionId: string;
  validationDecision: string;
  executionPlanId: string;
  executionPlan: Array<string>;
  executionResult: Array<string>;
  effectsLog: EffectsLog;
};

export type RevalidationDirectiveReady = {
  proposalId: string;
  revalidation: RevalidationCommitDirective;
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
  RevalidationDirectiveReady,
  RevalidationTrace
>;
