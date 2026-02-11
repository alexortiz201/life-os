import { z } from "zod";

import type { PipelineStageFn } from "#/platform/pipeline/stage/stage.types";
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";

import {
  IntakeInputSchema,
  IntakeRawProposalSchema,
  IntakeSchema,
} from "./intake.schemas";
import { INTAKE_RULES, STAGE } from "./intake.const";

export type IntakeInput = z.infer<typeof IntakeInputSchema>;
export type IntakeRawProposal = z.infer<typeof IntakeRawProposalSchema>;

export type IntakeEnvelope = IngestionPipelineEnvelope & {
  rawProposal: IntakeRawProposal;
};

export type IntakeErrorCode =
  | "STAGE_ALREADY_RAN"
  | "INTAKE_PREREQ_MISSING"
  | "INVALID_INTAKE_INPUT";

export type IntakeStage = PipelineStageFn<
  IntakeEnvelope,
  typeof STAGE,
  IntakeErrorCode,
  IngestionPipelineEnvelope
>;

export type Intake = z.infer<typeof IntakeSchema>;
export type IntakeRule = (typeof INTAKE_RULES)[number];
