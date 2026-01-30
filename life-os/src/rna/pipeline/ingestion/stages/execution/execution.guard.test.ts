import test from "node:test";
import assert from "node:assert/strict";

import {
  guardExecution,
  guardPreExecution,
} from "#/rna/pipeline/ingestion/stages/execution/execution.guard";
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";
import { makeEnv as makeEnvUtil } from "#/shared/test-utils";

function lastError(env: IngestionPipelineEnvelope) {
  return env.errors[env.errors.length - 1];
}

// Helper: cheap deep clone for env-like data
function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

const makeEnv = () =>
  makeEnvUtil({
    stages: {
      execution: { hasRun: false },
      revalidation: { hasRun: false },
      commit: { hasRun: false },
    },
  });

test("guardExecution returns ok:false INVALID_EXECUTION_INPUT when input shape is wrong", () => {
  const result = guardExecution({ nope: true } as any);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "INVALID_EXECUTION_INPUT");
    assert.equal(typeof result.message, "string");
    assert.ok(result.trace);
    assert.equal(result.trace.mode, "UNKNOWN");
    assert.ok(Array.isArray(result.trace.rulesApplied));
    assert.ok(result.trace.rulesApplied.includes("PARSE_FAILED"));
  }
});

test("guardExecution is pure: does not append errors or mutate env", () => {
  const env = makeEnv();

  // break something to force failure
  (env.ids as any).proposalId = "";

  const before = clone(env);
  const result = guardExecution(env as any);

  assert.equal(result.ok, false);

  // 🔒 pure: guard must not mutate env at all
  assert.deepEqual(env, before);
});

test("guardExecution does not enforce prereqs (missing planning/snapshotId does not append errors)", () => {
  const env = makeEnv();
  const beforeErrorsLen = env.errors.length;

  // prereqs are guardPreExecution's job, not guardExecution's job
  (env.stages.planning as any) = { hasRun: false };
  env.ids.snapshotId = undefined;

  const result = guardExecution(env as any);

  // It may return ok:false depending on schema,
  // but it must not append errors to env.
  assert.equal(env.errors.length, beforeErrorsLen);

  if (!result.ok) {
    assert.equal(result.code, "INVALID_EXECUTION_INPUT");
    assert.ok(result.trace?.rulesApplied?.includes("PARSE_FAILED"));
  }
});

test("guardExecution returns ok:true and plucks canonical inputs when schema passes", () => {
  const env = makeEnv();
  const result = guardExecution(env as any);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.proposalId, env.ids.proposalId);
    assert.equal(result.data.snapshotId, env.ids.snapshotId);

    // pluck: validationDecision should come from validation.validationId per pluckParams
    assert.equal(
      result.data.validationDecision,
      (env.stages.validation as any).validationId,
    );

    // pluck: planningId should come from ids
    assert.equal(result.data.planningId, env.ids.planningId);

    // ✅ critical: plan should come from planning stage, not validation stage
    const plan = result.data.plan;

    assert.equal(plan.length, 2);

    assert.equal(plan[0].stepId, "step_1");
    assert.equal(plan[0].kind, "PRODUCE_ARTIFACT");
    assert.deepEqual(plan[0].outputs.artifacts, [{ kind: "NOTE" }]);

    assert.equal(plan[1].stepId, "step_2");
    assert.equal(plan[1].kind, "EMIT_EVENT");
    assert.deepEqual(plan[1].outputs.events, [{ name: "REFLECTION_READY" }]);

    // commitPolicy should come from validation
    assert.deepEqual(
      result.data.commitPolicy,
      (env.stages.validation as any).commitPolicy,
    );
  }
});

///////////////// guardPreExecution //////////////////

test("guardPreExecution appends HALT error when planning stage has not run", () => {
  const env = makeEnv();
  (env.stages.planning as any) = { hasRun: false };

  const res = guardPreExecution(env);

  assert.equal(res.ok, false);
  assert.ok(res.env.errors.length >= 1);

  const err = lastError(res.env) as any;
  assert.equal(err.stage, "EXECUTION");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "EXECUTION_PREREQ_MISSING");

  // Keep trace assertions loose; preGuardFactory may evolve trace shape.
  assert.ok(err.trace);
  assert.equal(err.trace?.proposalId, env.ids.proposalId);
});

test("guardPreExecution appends HALT error when snapshotId is missing", () => {
  const env = makeEnv();
  env.ids.snapshotId = undefined;

  const res = guardPreExecution(env);

  assert.equal(res.ok, false);
  assert.ok(res.env.errors.length >= 1);

  const err = lastError(res.env) as any;
  assert.equal(err.stage, "EXECUTION");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "EXECUTION_PREREQ_MISSING");

  assert.ok(err.trace);
  assert.equal(err.trace?.proposalId, env.ids.proposalId);
});

test("guardPreExecution returns ok:true when prereqs are satisfied", () => {
  const env = makeEnv();

  // satisfy typical prereqs
  env.ids.snapshotId = env.ids.snapshotId ?? "snapshot_1";

  const res = guardPreExecution(env);

  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.env, env);
  }
});
