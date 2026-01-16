import test from "node:test";
import assert from "node:assert/strict";

import {
  guardExecution,
  guardPreExecution,
} from "#/rna/pipelines/ingestion/stages/execution/execution.guard";
import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";
import { makeEnv as makeEnvUtil } from "../../../../../utils";

function lastError(env: IngestionPipelineEnvelope) {
  return env.errors[env.errors.length - 1];
}

const makeEnv = () => makeEnvUtil({ stages: { execution: { hasRun: false } } });

test("guardExecution returns ok:false INVALID_EXECUTION_INPUT when input shape is wrong", () => {
  const result = guardExecution({ nope: true } as any);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "INVALID_EXECUTION_INPUT");
    assert.equal(typeof result.message, "string");
    assert.ok(result.trace);
    assert.equal(result.trace.mode, "UNKNOWN");
  }
});

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
  assert.ok(err.trace);
  assert.equal(err.trace.proposalId, env.ids.proposalId);
  assert.equal(err.trace.planningHasRun, false);
});

test("guardPreExecution appends HALT error when snapshotId is missing", () => {
  const env = makeEnv();
  (env.stages.planning as any) = {
    ...(env.stages.planning as any),
    hasRun: true,
  };
  env.ids.snapshotId = undefined;

  const res = guardPreExecution(env);

  assert.equal(res.ok, false);
  assert.ok(res.env.errors.length >= 1);

  const err = lastError(res.env) as any;
  assert.equal(err.stage, "EXECUTION");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "EXECUTION_PREREQ_MISSING");
  assert.ok(err.trace);
  assert.equal(err.trace.proposalId, env.ids.proposalId);
  assert.equal(err.trace.snapshotId, undefined);
});

test("guardPreExecution returns ok:true when prereqs are satisfied", () => {
  const env = makeEnv();
  (env.stages.planning as any) = {
    ...(env.stages.planning as any),
    hasRun: true,
  };
  env.ids.snapshotId = env.ids.snapshotId ?? "snapshot_1";

  const res = guardPreExecution(env);

  assert.equal(res.ok, true);
  assert.equal(res.env, env);
});
