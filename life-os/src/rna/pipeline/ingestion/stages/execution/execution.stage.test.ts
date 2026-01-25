import test from "node:test";
import assert from "node:assert/strict";

import * as E from "fp-ts/Either";

import { executionStage } from "#/rna/pipeline/ingestion/stages/execution/execution.stage";
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";
import {
  makeEnv as makeEnvUtil,
  lastError,
  unwrapRight,
  unwrapLeft,
} from "#/shared/test-utils";

const makeEnv = () => makeEnvUtil({ stages: { execution: { hasRun: false } } });

test("does nothing when earlier HALT errors exist (fails closed)", () => {
  const env = makeEnv();
  env.errors.push({
    stage: "VALIDATION" as any,
    severity: "HALT",
    code: "SOME_HALTING_ERROR",
    message: "stop",
    at: Date.now(),
  });

  const out = executionStage(env);

  assert.ok(E.isRight(out));
  // should return the same env reference (no-op)
  assert.equal(out.right, env);
});

test("appends HALT error when planning stage has not run", () => {
  const env = makeEnv();
  (env.stages.planning as any) = { hasRun: false };

  const out = executionStage(env);
  const left = unwrapLeft(out) as any;

  const nextEnv = left.env as IngestionPipelineEnvelope;

  assert.equal(nextEnv.stages.execution.hasRun, false);
  assert.ok(nextEnv.errors.length >= 1);

  const err = lastError(nextEnv) as any;
  assert.equal(err.stage, "EXECUTION");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "EXECUTION_PREREQ_MISSING");
});

test("appends HALT error when snapshotId is missing", () => {
  const env = makeEnv();
  (env.stages.planning as any) = {
    ...(env.stages.planning as any),
    hasRun: true,
  };
  env.ids.snapshotId = undefined;

  const out = executionStage(env);
  const left = unwrapLeft(out) as any;

  const nextEnv = left.env as IngestionPipelineEnvelope;

  assert.equal(nextEnv.stages.execution.hasRun, false);
  assert.ok(nextEnv.errors.length >= 1);

  const err = lastError(nextEnv) as any;
  assert.equal(err.stage, "EXECUTION");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "EXECUTION_PREREQ_MISSING");
});

test("fails closed if execution input is invalid (guardExecution enforced)", () => {
  const env = makeEnv();

  // Satisfy prereqs so we reach guardExecution.
  (env.stages.planning as any) = {
    ...(env.stages.planning as any),
    hasRun: true,
  };
  env.ids.snapshotId = env.ids.snapshotId ?? "snapshot_1";

  // Corrupt a required identifier to force guardExecution to fail
  (env.ids as any).proposalId = "";

  const out = executionStage(env);
  const left = unwrapLeft(out) as any;

  const nextEnv = left.env as IngestionPipelineEnvelope;

  assert.equal(nextEnv.stages.execution.hasRun, false);
  assert.ok(nextEnv.errors.length >= 1);

  const err = lastError(nextEnv) as any;
  assert.equal(err.stage, "EXECUTION");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "INVALID_EXECUTION_INPUT");
});

test("writes execution stage output + ids when prereqs satisfied and guard passes", () => {
  const env = makeEnv();

  // Explicit prereqs
  (env.stages.planning as any) = {
    ...(env.stages.planning as any),
    hasRun: true,
  };
  env.ids.snapshotId = env.ids.snapshotId ?? "snapshot_1";
  env.ids.proposalId = env.ids.proposalId ?? "proposal_1";

  const out = executionStage(env);
  const nextEnv = unwrapRight(out);

  assert.equal(nextEnv.errors.length, 0);
  assert.equal(nextEnv.stages.execution.hasRun, true);

  // ids written (shape expectation, not exact value)
  assert.equal(typeof nextEnv.ids.executionId, "string");
  assert.ok(nextEnv.ids.executionId);
  assert.ok(nextEnv.ids.executionId.length > 0);

  assert.equal(typeof nextEnv.ids.effectsLogId, "string");
  assert.ok(nextEnv.ids.effectsLogId);
  assert.ok(nextEnv.ids.effectsLogId.length > 0);

  const x = nextEnv.stages.execution as any;

  // stage writeback
  assert.equal(typeof x.ranAt, "number");
  assert.equal(x.executionId, nextEnv.ids.executionId);

  // observed invariants (audit wiring)
  assert.ok(x.observed);
  assert.equal(x.observed.proposalId, nextEnv.ids.proposalId);
  assert.equal(x.observed.snapshotId, nextEnv.ids.snapshotId);
  assert.equal(x.observed.planningId, nextEnv.ids.planningId);

  // effects log invariants (must exist even if empty)
  assert.ok(x.effectsLog);
  assert.equal(x.effectsLog.effectsLogId, nextEnv.ids.effectsLogId);
  assert.equal(x.effectsLog.proposalId, nextEnv.ids.proposalId);
  assert.ok(Array.isArray(x.effectsLog.producedEffects));

  // execution MUST NOT emit COMMITTED trust
  for (const e of x.effectsLog.producedEffects) {
    assert.notEqual((e as any).trust, "COMMITTED");
  }
});

test("effectsLog.proposalId matches envelope proposalId (drift prevention baseline)", () => {
  const env = makeEnv();

  (env.stages.planning as any) = {
    ...(env.stages.planning as any),
    hasRun: true,
  };
  env.ids.snapshotId = env.ids.snapshotId ?? "snapshot_1";
  env.ids.proposalId = env.ids.proposalId ?? "proposal_1";

  const out = executionStage(env);
  const nextEnv = unwrapRight(out);

  const x = nextEnv.stages.execution as any;
  assert.equal(x.effectsLog.proposalId, nextEnv.ids.proposalId);
});
