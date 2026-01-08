import test from "node:test";
import assert from "node:assert/strict";

import { revalidationStage } from "#/rna/pipelines/ingestion/stages/revalidation/revalidation.stage";
import type { RevalidationInput } from "#types/rna/pipeline/ingestion/revalidation/revalidation.types";

function makeInput(overrides?: Partial<RevalidationInput>): RevalidationInput {
  return {
    proposalId: "proposal_1",
    revisionId: "rev_1",
    validationDecision: "validation_decision_1",
    executionPlanId: "plan_1",
    executionPlan: ["step_1"],
    executionResult: ["ok"],
    commitPolicy: { allowedModes: ["FULL"] },
    effectsLog: {
      effectsLogId: "effects_1",
      proposalId: "proposal_1",
      producedEffects: [],
    } as any,
    ...overrides,
  };
}

test("throws when guardRevalidation returns ok:false", () => {
  assert.throws(() => {
    revalidationStage({ nope: true } as any);
  }, /INVALID_REVALIDATION_INPUT|PARTIAL_NOT_ALLOWED/);
});

test("returns directive-ready output from guard (APPROVE_COMMIT)", () => {
  const out = revalidationStage(
    makeInput({
      effectsLog: {
        effectsLogId: "effects_1",
        proposalId: "proposal_1",
        producedEffects: [
          {
            effectType: "ARTIFACT",
            objectId: "note_1",
            kind: "NOTE",
            trust: "PROVISIONAL",
          },
        ],
      } as any,
    })
  );

  assert.equal(out.proposalId, "proposal_1");
  assert.equal(out.revalidation.outcome, "APPROVE_COMMIT");
});

test("returns directive-ready output from guard (REJECT_COMMIT on drift)", () => {
  const out = revalidationStage(
    makeInput({
      effectsLog: {
        effectsLogId: "effects_1",
        proposalId: "proposal_X",
        producedEffects: [],
      } as any,
    })
  );

  assert.equal(out.revalidation.outcome, "REJECT_COMMIT");
  assert.ok(out.revalidation.rulesApplied.includes("DRIFT_DETECTED"));
});
