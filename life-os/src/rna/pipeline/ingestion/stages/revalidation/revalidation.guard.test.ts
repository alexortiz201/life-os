import test from "node:test";
import assert from "node:assert/strict";

import { guardRevalidation } from "#/rna/pipeline/ingestion/stages/revalidation/revalidation.guard";
import { makeEnv as makeEnvUtil, resetStagesUpTo } from "#/shared/test-utils";

const makeEnv = () => resetStagesUpTo("revalidation", makeEnvUtil());

//////////////////// Guard
test("guardRevalidation returns ok:false INVALID_REVALIDATION_INPUT when input shape is wrong", () => {
  const result = guardRevalidation({ nope: true } as any);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "INVALID_REVALIDATION_INPUT");
    assert.equal(typeof result.message, "string");
    assert.ok(result.trace);
    assert.equal(result.trace.mode, "UNKNOWN");
  }
});

test("guardRevalidation returns ok:false when required plucked fields are missing (parse fails)", () => {
  const env = makeEnv();

  // break a required field for schema parsing
  env.ids.snapshotId = undefined;

  const result = guardRevalidation(env as any);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "INVALID_REVALIDATION_INPUT");
    assert.ok(result.trace?.rulesApplied?.includes("PARSE_FAILED"));
  }
});

test("guardRevalidation returns ok:true and plucks + parses the expected fields", () => {
  const env = makeEnv();
  const result = guardRevalidation(env as any);

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.data.proposalId, env.ids.proposalId);
    assert.equal(result.data.snapshotId, env.ids.snapshotId);
    assert.equal(result.data.executionId, env.ids.executionId);
    assert.equal(result.data.planningId, env.ids.planningId);

    // from stages.validation.validationId
    assert.equal(result.data.validationDecision, "validation_1");

    // plan should be the modeled plan (not string[])
    assert.deepEqual(result.data.plan, (env.stages.planning as any).plan);

    // commitPolicy must be present + typed
    assert.deepEqual(result.data.commitPolicy, {
      allowedModes: ["FULL"],
    });

    // effectsLog should be an object
    assert.deepEqual(
      result.data.effectsLog,
      (env.stages.execution as any).effectsLog,
    );
  }
});
