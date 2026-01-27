import test from "node:test";
import assert from "node:assert/strict";

import {
  guardPlanning,
  guardPrePlanning,
} from "#/rna/pipeline/ingestion/stages/planning/planning.guard";
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";

import { makeEnv } from "#/shared/test-utils";

test("returns ok:false INVALID_PLANNING_INPUT when input shape is wrong", () => {
  const result = guardPlanning({ nope: true } as any);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "INVALID_PLANNING_INPUT");
    assert.equal(typeof result.message, "string");
    assert.ok(result.trace);
    assert.equal(result.trace.mode, "UNKNOWN");
    assert.ok(Array.isArray(result.trace.rulesApplied));
    assert.ok(result.trace.rulesApplied.includes("PARSE_FAILED"));
  }
});

test("guardPlanning does not append envelope errors or mutate env (pure parse guard)", () => {
  const env = makeEnv();
  const beforeErrorsLen = env.errors.length;
  const beforePlanningHasRun = (env.stages.planning as any)?.hasRun;
  const beforePlanningId = env.ids.planningId;

  // Force failure by breaking the input in a way the schema should reject
  env.ids.proposalId = "" as any;

  const result = guardPlanning(env as any);

  assert.equal(result.ok, false);

  // 🔒 guard is pure: must not mutate env
  assert.equal(env.errors.length, beforeErrorsLen);
  assert.equal((env.stages.planning as any)?.hasRun, beforePlanningHasRun);
  assert.equal(env.ids.planningId, beforePlanningId);
});

test("guardPlanning does not enforce prereqs via side-effects (missing snapshotId does not append errors)", () => {
  const env = makeEnv();
  const beforeErrorsLen = env.errors.length;

  // Missing input field that the schema should require
  env.ids.snapshotId = undefined;

  const result = guardPlanning(env as any);

  // The key assertion: it must not append errors to env.
  assert.equal(env.errors.length, beforeErrorsLen);

  // If it fails, it should be a parse/shape failure code
  if (!result.ok) {
    assert.equal(result.code, "INVALID_PLANNING_INPUT");
    assert.ok(result.trace?.rulesApplied?.includes("PARSE_FAILED"));
  }
});

test("returns ok:true with parsed planning input when deps satisfied + schema passes", () => {
  const env = makeEnv();

  // prereqs that guardFactory narrowing + schema likely require
  env.ids.snapshotId = env.ids.snapshotId ?? "snapshot_1";

  // ✅ guardPrePlanning likely requires validation.hasRun === true and validationId exists
  (env.stages.validation as any) = {
    ...(env.stages.validation as any),
    hasRun: true,
    validationId: env.ids.validationId ?? "validation_1",
    // ✅ pluckParams passes commitPolicy through; schema may require it
    commitPolicy: { allowedModes: ["FULL", "PARTIAL"] as const },
  };

  const result = guardPlanning(env as any);

  assert.equal(result.ok, true);
  if (result.ok) {
    // plucked inputs
    assert.equal(result.data.proposalId, env.ids.proposalId);
    assert.equal(result.data.snapshotId, env.ids.snapshotId);

    // NOTE: pluckParams currently sets this from validation.validationId
    assert.equal(
      result.data.validationDecision,
      (env.stages.validation as any).validationId
    );

    // planningId is not created yet at planning time, so pluck defaults it
    assert.equal(
      result.data.planningId,
      env.ids.planningId ?? "planning_unknown"
    );

    // plan is currently plucked from stages.validation (bug/placeholder),
    // so it should fall back to [].
    assert.ok(Array.isArray(result.data.plan));
    assert.deepEqual(result.data.plan, []);

    // commitPolicy should be present if schema requires it
    assert.ok(result.data.commitPolicy);
  }
});

test("returns ok:false INVALID_PLANNING_INPUT when schema parse fails (fail closed, no env mutation)", () => {
  const env = makeEnv();
  const beforeErrorsLen = env.errors.length;

  // satisfy dependency presence
  (env.stages.validation as any) = {
    ...(env.stages.validation as any),
    hasRun: true,
    validationId: env.ids.validationId ?? "validation_1",
    commitPolicy: { allowedModes: ["FULL", "PARTIAL"] as const },
  };

  // make schema fail: snapshotId undefined is a clean way to break a required string
  env.ids.snapshotId = undefined;

  const result = guardPlanning(env as any);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "INVALID_PLANNING_INPUT");
    assert.equal(result.trace.mode, "UNKNOWN");
    assert.ok(result.trace.rulesApplied?.includes("PARSE_FAILED"));
  }

  // 🔒 guard is pure: must not append errors
  assert.equal(env.errors.length, beforeErrorsLen);
});

///////////// GuardPrePlanning
function lastError(env: IngestionPipelineEnvelope) {
  return env.errors[env.errors.length - 1];
}

test("appends HALT PLANNING_PREREQ_MISSING when required prior stage has not run (VALIDATION)", () => {
  const env = makeEnv();

  (env.stages.validation as any) = {
    ...(env.stages.validation as any),
    hasRun: false,
  };

  const result = guardPrePlanning(env);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.env.errors.length >= 1);
    const err = lastError(result.env) as any;

    assert.equal(err.stage, "PLANNING");
    assert.equal(err.severity, "HALT");
    assert.equal(err.code, "PLANNING_PREREQ_MISSING");
  }
});

test("appends HALT PLANNING_PREREQ_MISSING when required ids are missing (validationId)", () => {
  const env = makeEnv();

  // planning deps require validationId per your dependency logic
  env.ids.validationId = undefined;

  const result = guardPrePlanning(env);

  assert.equal(result.ok, false);
  if (!result.ok) {
    const err = lastError(result.env) as any;

    assert.equal(err.stage, "PLANNING");
    assert.equal(err.severity, "HALT");
    assert.equal(err.code, "PLANNING_PREREQ_MISSING");

    assert.equal(err.trace?.proposalId, env.ids.proposalId);
    assert.equal(err.trace?.idKey, "validationId");
    assert.equal(err.trace?.value, undefined);
  }
});

test("appends HALT PLANNING_PREREQ_MISSING when required ids are missing (snapshotId)", () => {
  const env = makeEnv();

  env.ids.snapshotId = undefined;

  const result = guardPrePlanning(env);

  assert.equal(result.ok, false);
  if (!result.ok) {
    const err = lastError(result.env) as any;

    assert.equal(err.stage, "PLANNING");
    assert.equal(err.severity, "HALT");
    assert.equal(err.code, "PLANNING_PREREQ_MISSING");

    assert.equal(err.trace?.proposalId, env.ids.proposalId);
    assert.equal(err.trace?.idKey, "snapshotId");
    assert.equal(err.trace?.value, undefined);
  }
});

test("returns ok:true when dependencies are satisfied (VALIDATION hasRun + ids present)", () => {
  const env = makeEnv();

  (env.stages.validation as any) = {
    ...(env.stages.validation as any),
    hasRun: true,
  };

  env.ids.validationId = env.ids.validationId ?? "validation_1";
  env.ids.snapshotId = env.ids.snapshotId ?? "snapshot_1";

  const result = guardPrePlanning(env);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.env, env);
    assert.equal(result.env.errors.length, env.errors.length);
  }
});

test("fail-closed: does not mark planning as run and does not create planningId on prereq failure", () => {
  const env = makeEnv();

  (env.stages.validation as any) = {
    ...(env.stages.validation as any),
    hasRun: false,
  };

  const result = guardPrePlanning(env);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(
      (result.env.stages.planning as any)?.hasRun,
      (env.stages.planning as any)?.hasRun
    );
    assert.equal(result.env.ids.planningId, env.ids.planningId);
  }
});
