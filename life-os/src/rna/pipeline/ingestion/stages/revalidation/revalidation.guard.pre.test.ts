import test from "node:test";
import assert from "node:assert/strict";

import { guardPreRevalidation } from "#/rna/pipeline/ingestion/stages/revalidation/revalidation.guard";
import {
  makeEnv as makeEnvUtil,
  resetStagesUpTo,
  lastError,
} from "#/shared/test-utils";

const makeEnv = () => resetStagesUpTo("revalidation", makeEnvUtil());

//////////////////// PreGuard
test("guardPreRevalidation: HALT when execution stage has not run", () => {
  const env = makeEnv();

  // prereq violated
  (env.stages.execution as any) = {
    ...(env.stages.execution as any),
    hasRun: false,
  };

  const res = guardPreRevalidation(env);

  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.ok(res.env.errors.length >= 1);

    const err = lastError(res.env) as any;
    assert.equal(err.stage, "REVALIDATION");
    assert.equal(err.severity, "HALT");
    assert.equal(err.code, "REVALIDATION_PREREQ_MISSING");

    // trace contract: should explain what failed (shape may vary)
    assert.ok(err.trace);
    assert.equal(err.trace.proposalId, env.ids.proposalId);
    assert.ok(
      "executionHasRun" in err.trace ||
        "stageKey" in err.trace ||
        "dependsOn" in err.trace,
    );
  }
});

test("guardPreRevalidation: HALT when validation stage has not run", () => {
  const env = makeEnv();

  // prereq violated
  (env.stages.validation as any) = {
    ...(env.stages.validation as any),
    hasRun: false,
  };

  const res = guardPreRevalidation(env);

  assert.equal(res.ok, false);
  if (!res.ok) {
    const err = lastError(res.env) as any;

    assert.equal(err.stage, "REVALIDATION");
    assert.equal(err.severity, "HALT");
    assert.equal(err.code, "REVALIDATION_PREREQ_MISSING");

    assert.ok(err.trace);
    assert.equal(err.trace.proposalId, env.ids.proposalId);
    assert.ok(
      "validationHasRun" in err.trace ||
        "stageKey" in err.trace ||
        "dependsOn" in err.trace,
    );
  }
});

test("guardPreRevalidation: HALT when snapshotId missing", () => {
  const env = makeEnv();

  // prereq violated
  env.ids.snapshotId = undefined;

  const res = guardPreRevalidation(env);

  assert.equal(res.ok, false);
  if (!res.ok) {
    const err = lastError(res.env) as any;

    assert.equal(err.stage, "REVALIDATION");
    assert.equal(err.severity, "HALT");
    assert.equal(err.code, "REVALIDATION_PREREQ_MISSING");

    assert.ok(err.trace);
    assert.equal(err.trace.proposalId, env.ids.proposalId);

    // many of your preguards use { idKey, value } pattern
    if ("idKey" in err.trace) {
      assert.equal(err.trace.idKey, "snapshotId");
    }
  }
});

test("guardPreRevalidation: HALT when effectsLogId missing", () => {
  const env = makeEnv();

  // prereq violated
  env.ids.effectsLogId = undefined;

  const res = guardPreRevalidation(env);

  assert.equal(res.ok, false);
  if (!res.ok) {
    const err = lastError(res.env) as any;

    assert.equal(err.stage, "REVALIDATION");
    assert.equal(err.severity, "HALT");
    assert.equal(err.code, "REVALIDATION_PREREQ_MISSING");

    assert.ok(err.trace);
    assert.equal(err.trace.proposalId, env.ids.proposalId);

    if ("idKey" in err.trace) {
      assert.equal(err.trace.idKey, "effectsLogId");
    }
  }
});

test("guardPreRevalidation: ok:true when prereqs satisfied", () => {
  const env = makeEnv();
  const res = guardPreRevalidation(env);

  assert.equal(res.ok, true);
  if (res.ok) {
    // should be identity on env
    assert.equal(res.env, env);
  }
});

test("guardPreRevalidation: fail-closed does not mark revalidation as run or create revalidationId", () => {
  const env = makeEnv();

  // force a prereq failure
  (env.stages.execution as any) = {
    ...(env.stages.execution as any),
    hasRun: false,
  };

  const beforeHasRun = (env.stages.revalidation as any)?.hasRun;
  const beforeRevalidationId = env.ids.revalidationId;

  const res = guardPreRevalidation(env);

  assert.equal(res.ok, false);
  if (!res.ok) {
    // prereq guard should only append an error; it should not write success outputs
    assert.equal((res.env.stages.revalidation as any)?.hasRun, beforeHasRun);
    assert.equal(res.env.ids.revalidationId, beforeRevalidationId);
  }
});
