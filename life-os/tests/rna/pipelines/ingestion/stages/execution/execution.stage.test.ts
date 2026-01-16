import test from "node:test";
import assert from "node:assert/strict";

import { executionStage } from "#/rna/pipelines/ingestion/stages/execution/execution.stage";
import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";
import { makeEnv as makeEnvUtil } from "../../../../../utils";

function lastError(env: IngestionPipelineEnvelope) {
  return env.errors[env.errors.length - 1];
}

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

  // Contract expectation: no forward progress when HALT exists.
  assert.equal(out, env);
});

test("appends HALT error when planning stage has not run", () => {
  const env = makeEnv();
  (env.stages.planning as any) = { hasRun: false };

  const out = executionStage(env);

  assert.equal(out.stages.execution.hasRun, false);
  assert.ok(out.errors.length >= 1);

  const err = lastError(out) as any;
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

  assert.equal(out.stages.execution.hasRun, false);
  assert.ok(out.errors.length >= 1);

  const err = lastError(out) as any;
  assert.equal(err.stage, "EXECUTION");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "EXECUTION_PREREQ_MISSING");
});

test("fails closed if execution output shape is invalid (guardExecution enforced)", () => {
  const env = makeEnv();

  // Satisfy prereqs so we reach output validation.
  (env.stages.planning as any) = {
    ...(env.stages.planning as any),
    hasRun: true,
  };
  env.ids.snapshotId = env.ids.snapshotId ?? "snapshot_1";

  // Corrupt a required identifier to force invalid output shape.
  // Contract expectation: stage validates its own artifacts before writing/marking hasRun.
  (env.ids as any).proposalId = "";

  const out = executionStage(env);

  assert.equal(out.stages.execution.hasRun, false);
  assert.ok(out.errors.length >= 1);

  const err = lastError(out) as any;
  assert.equal(err.stage, "EXECUTION");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "INVALID_EXECUTION_INPUT");
});

test("writes execution stage output + ids when prereqs satisfied and output validates", () => {
  const env = makeEnv();

  // Explicit prereqs
  (env.stages.planning as any) = {
    ...(env.stages.planning as any),
    hasRun: true,
  };
  env.ids.snapshotId = env.ids.snapshotId ?? "snapshot_1";
  env.ids.proposalId = env.ids.proposalId ?? "proposal_1";

  const out = executionStage(env);

  assert.equal(out.errors.length, 0);
  assert.equal(out.stages.execution.hasRun, true);

  // ids written (shape expectation, not exact value)
  assert.equal(typeof out.ids.executionId, "string");
  assert.ok(out.ids.executionId);
  assert.ok(out.ids.executionId.length > 0);

  assert.equal(typeof out.ids.effectsLogId, "string");
  assert.ok(out.ids.effectsLogId);
  assert.ok(out.ids.effectsLogId.length > 0);

  const x = out.stages.execution as any;

  // stage writeback
  assert.equal(typeof x.ranAt, "number");
  assert.equal(x.executionId, out.ids.executionId);

  // observed invariants (audit wiring)
  assert.ok(x.observed);
  assert.equal(x.observed.proposalId, out.ids.proposalId);
  assert.equal(x.observed.snapshotId, out.ids.snapshotId);
  assert.equal(x.observed.planningId, out.ids.planningId);

  // effects log invariants (must exist even if empty)
  assert.ok(x.effectsLog);
  assert.equal(x.effectsLog.effectsLogId, out.ids.effectsLogId);
  assert.equal(x.effectsLog.proposalId, out.ids.proposalId);
  assert.ok(Array.isArray(x.effectsLog.producedEffects));

  // “Execution makes things happen without belief”:
  // execution MUST NOT emit COMMITTED trust.
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

  const x = out.stages.execution as any;
  assert.equal(x.effectsLog.proposalId, out.ids.proposalId);
});
