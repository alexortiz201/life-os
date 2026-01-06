import z from "zod";
import { CommitInputSchema, ProducedEffectSchema } from "./commit.schemas";
import type { TrustLevel } from "#types/domain/trust/trust.types";
import type { PrecommitRule } from "./commit.rules";

export type TrustPromotionRecord = {
  objectId: string;
  from: "PROVISIONAL";
  to: "COMMITTED";
  stage: "COMMIT";
  reason: string;
  proposalId: string;
  effectsLogId: string;
  commitId: string;
};

type Note = any;

export type Mode = "FULL" | "PARTIAL" | "UNKNOWN";

export type EligibleEffect = z.infer<typeof ProducedEffectSchema>;

export type ApprovedEffect = {
  objectId: string;
  kind: string;
  trust: "COMMITTED";
};

export type RejectedEffect = {
  objectId: string;
  kind: string;
  originalTrust: TrustLevel;
  trust: TrustLevel;
  reasonCode: string;
  reason: string;
};

export type Justification = {
  mode: CommitReadyMode;
  rulesApplied: PrecommitRule[];
  inputs: Array<{
    commitId: string;
    proposalId: string;
    allowListCount: number;
  }>;
  notes?: Array<Note>;
};

export type CommitRecord = {
  commitId: string;
  proposalId: string;
  promotions: Array<TrustPromotionRecord>;
  approvedEffects: Array<ApprovedEffect>;
  rejectedEffects: Array<RejectedEffect>;
  justification: Justification;
};

export type CommitInput = z.infer<typeof CommitInputSchema>;

// success-only mode (since you fail-closed on unsupported outcomes)
export type CommitReadyMode = Exclude<Mode, "UNKNOWN">;

export type CommitReady = {
  proposalId: string;
  effectsLogId: string;
  mode: CommitReadyMode;
  eligibleEffects: Array<EligibleEffect>;
  allowListCount: number;
  rulesApplied: PrecommitRule[];
  rejectedEffects: Array<RejectedEffect>;
};

export type Trace = Partial<{
  mode: Mode;
  proposalId: string;
  revalidationDeclaredProposalId: string;
  effectsLogDeclaredProposalId: string;
  effectsLogId: string;
  allowListCount: number;
  rulesApplied: PrecommitRule[];
}>;

export type GuardPrecommitResult =
  | { ok: true; data: CommitReady }
  | { ok: false; code: string; message: string; trace: Trace };
