import test from "node:test";
import assert from "node:assert/strict";

import { guardRevalidation } from "#/rna/pipelines/ingestion/stages/revalidation/revalidation.guard";
import type { RevalidationInput } from "#types/rna/pipeline/ingestion/revalidation/revalidation.types";
import { eventNames } from "node:cluster";

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

test("returns ok:false INVALID_REVALIDATION_INPUT when input shape is wrong", () => {
  const result = guardRevalidation({ nope: true } as any);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "INVALID_REVALIDATION_INPUT");
    assert.equal(typeof result.message, "string");
    assert.ok(result.trace);
    assert.equal(result.trace.mode, "UNKNOWN");
  }
});

test("returns ok:true REJECT_COMMIT when proposalId mismatches effectsLog.proposalId (drift surrogate)", () => {
  const result = guardRevalidation(
    makeInput({
      effectsLog: {
        effectsLogId: "effects_1",
        proposalId: "proposal_X",
        producedEffects: [],
      } as any,
    })
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.revalidation.outcome, "REJECT_COMMIT");
    assert.ok(result.data.revalidation.rulesApplied.includes("DRIFT_DETECTED"));
  }
});

test("FULL-only policy fails closed if PARTIAL would be required (non-artifact effects present)", () => {
  const result = guardRevalidation(
    makeInput({
      commitPolicy: { allowedModes: ["FULL"] },
      effectsLog: {
        effectsLogId: "effects_1",
        proposalId: "proposal_1",
        producedEffects: [
          {
            effectType: "EVENT",
            eventName: "TRIGGER_PIPELINE",
            trust: "PROVISIONAL",
          },
          {
            effectType: "ARTIFACT",
            objectId: "note_1",
            kind: "NOTE",
            trust: "PROVISIONAL",
          },
        ],
      },
    })
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "PARTIAL_NOT_ALLOWED");
    assert.ok(
      result.trace.rulesApplied?.includes("NON_ARTIFACT_EFFECTS_PRESENT")
    );
    assert.ok(
      result.trace.rulesApplied?.includes("PARTIAL_NOT_ALLOWED_BY_POLICY")
    );
  }
});

test("PARTIAL allowed produces PARTIAL_COMMIT and allowlist of provisional ARTIFACT ids", () => {
  const result = guardRevalidation(
    makeInput({
      commitPolicy: { allowedModes: ["FULL", "PARTIAL"] },
      effectsLog: {
        effectsLogId: "effects_1",
        proposalId: "proposal_1",
        producedEffects: [
          {
            effectType: "EVENT",
            eventName: "TRIGGER_PIPELINE",
            trust: "PROVISIONAL",
          },
          {
            effectType: "ARTIFACT",
            objectId: "note_1",
            kind: "NOTE",
            trust: "PROVISIONAL",
          },
          {
            effectType: "ARTIFACT",
            objectId: "note_2",
            kind: "NOTE",
            trust: "COMMITTED",
          },
        ],
      },
    })
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.revalidation.outcome, "PARTIAL_COMMIT");
    assert.deepEqual(result.data.revalidation.commitAllowList, ["note_1"]);
    assert.ok(
      result.data.revalidation.rulesApplied.includes(
        "NON_ARTIFACT_EFFECTS_PRESENT"
      )
    );
  }
});

test("no drift + no non-artifact effects => APPROVE_COMMIT", () => {
  const result = guardRevalidation(
    makeInput({
      commitPolicy: { allowedModes: ["FULL"] },
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

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.revalidation.outcome, "APPROVE_COMMIT");
    assert.deepEqual(result.data.revalidation.commitAllowList, []);
  }
});
