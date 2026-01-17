// planning.stage.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import { planningStage } from "#/rna/pipelines/ingestion/stages/planning/planning.stage";
import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";
import { makeEnv } from "../../../../../utils";

function lastError(env: IngestionPipelineEnvelope) {
  return env.errors[env.errors.length - 1];
}

// Helper: cheap deep clone for env-like data
function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

test("appends HALT error when validation stage has not run", () => {
  const env = makeEnv();
  (env.stages.validation as any) = { hasRun: false };

  const out = planningStage(env);

  assert.equal(out.stages.planning.hasRun, false);
  assert.ok(out.errors.length >= 1);

  const err = lastError(out) as any;
  assert.equal(err.stage, "PLANNING");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "PLANNING_PREREQ_MISSING");
});

test("appends HALT error when proposalId missing", () => {
  const env = makeEnv();
  env.ids.proposalId = "" as any;

  const out = planningStage(env);

  assert.equal(out.stages.planning.hasRun, false);
  assert.ok(out.errors.length >= 1);

  const err = lastError(out) as any;
  assert.equal(err.stage, "PLANNING");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "INVALID_PLANNING_INPUT");
});

test("appends HALT error when snapshotId missing (plan must be pinned to a snapshot)", () => {
  const env = makeEnv();
  env.ids.snapshotId = undefined;

  const out = planningStage(env);

  assert.equal(out.stages.planning.hasRun, false);
  assert.ok(out.errors.length >= 1);

  const err = lastError(out) as any;
  assert.equal(err.stage, "PLANNING");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "PLANNING_PREREQ_MISSING");
});

test("writes a deterministic, untrusted plan artifact and does not execute", () => {
  const env = makeEnv();

  // Ensure validation looks "approved enough" for planning to proceed.
  // (Adjust field names if your validation output differs.)
  (env.stages.validation as any) = {
    ...(env.stages.validation as any),
    hasRun: true,
    // common pattern in your pipeline: validationId exists if hasRun
    validationId: env.ids.validationId ?? "validation_1",
    // optionally include commitPolicy if your planning input uses it
    commitPolicy: { allowedModes: ["FULL"] as const },
    // If you have an explicit decision field, set it to APPROVE/PARTIAL_APPROVE
    decision: "APPROVE",
  };

  const out = planningStage(env);

  // No errors and stage marked as run
  assert.equal(out.errors.length, 0);
  assert.equal(out.stages.planning.hasRun, true);

  // Must write a planningId
  assert.equal(typeof out.ids.planningId, "string");
  assert.ok((out.ids.planningId as any).length > 0);

  const p = out.stages.planning as any;

  // Must write plan artifact fields (shape-level expectations)
  assert.equal(p.planId, out.ids.planningId);
  assert.equal(typeof p.ranAt, "number");
  assert.ok(Array.isArray(p.plan));

  // Must include a deterministic fingerprint field (contract)
  // Name may vary; accept either `planFingerprint` or `fingerprint`.
  const fp = p.planFingerprint ?? p.fingerprint;
  assert.equal(typeof fp, "string");
  assert.ok(fp.length > 0);

  // Planning is descriptive: must not flip execution on
  assert.equal((out.stages.execution as any)?.hasRun, false);

  // Planning must not create effects log ids
  assert.equal(out.ids.effectsLogId, undefined);

  // Planning must not create producedEffects anywhere
  // (Defensive: ensure we didn't accidentally attach an effectsLog.)
  assert.equal((out.stages.planning as any)?.effectsLog, undefined);
  assert.equal((out.stages.execution as any)?.effectsLog, undefined);

  // Planning must not create COMMITTED artifacts (trust escalation forbidden)
  // (If you store trust on the plan, it must not be COMMITTED.)
  if (typeof p.trust === "string") {
    assert.notEqual(p.trust, "COMMITTED");
  }
});

test("planning does not mutate validation output (must honor constraints verbatim)", () => {
  const env = makeEnv();

  // Make validation deterministic and capture before/after
  (env.stages.validation as any) = {
    ...(env.stages.validation as any),
    hasRun: true,
    validationId: "validation_1",
    commitPolicy: { allowedModes: ["FULL", "PARTIAL"] as const },
    decision: "APPROVE",
    constraints: { scope: ["NOTES_ONLY"], forbid: ["TRUST_ESCALATION"] },
  };

  const before = clone(env.stages.validation as any);

  const out = planningStage(env);

  assert.equal(out.errors.length, 0);
  assert.equal(out.stages.planning.hasRun, true);

  const after = out.stages.validation as any;

  // Must not reinterpret or rewrite validation outputs
  assert.deepEqual(after, before);
});

test("identical inputs produce identical plans (determinism invariant)", () => {
  const env1 = makeEnv();
  const env2 = clone(env1);

  (env1.stages.validation as any) = {
    ...(env1.stages.validation as any),
    hasRun: true,
    validationId: "validation_1",
    decision: "APPROVE",
  };

  (env2.stages.validation as any) = {
    ...(env2.stages.validation as any),
    hasRun: true,
    validationId: "validation_1",
    decision: "APPROVE",
  };

  const out1 = planningStage(env1);
  const out2 = planningStage(env2);

  assert.equal(out1.errors.length, 0);
  assert.equal(out2.errors.length, 0);

  const p1 = out1.stages.planning as any;
  const p2 = out2.stages.planning as any;

  // Plan and fingerprint must match for identical inputs
  const fp1 = p1.planFingerprint ?? p1.fingerprint;
  const fp2 = p2.planFingerprint ?? p2.fingerprint;

  assert.equal(fp1, fp2);
  assert.deepEqual(p1.plan, p2.plan);
});

test("planning failure fails closed (no advancement / no planId)", () => {
  const env = makeEnv();

  // Force a condition that should make planning unable to produce an explicit plan.
  // If your implementation relies on a capabilities snapshot, simulate missing capabilities.
  (env.stages.validation as any) = {
    ...(env.stages.validation as any),
    hasRun: true,
    validationId: "validation_1",
    decision: "APPROVE",
  };

  // Underspecified intent surrogate: remove/blank proposal record if present
  // (Adjust field name to match your envelope; leaving as defensive no-op.)
  (env as any).proposal = undefined;

  const out = planningStage(env);

  assert.equal(out.stages.planning.hasRun, false);
  assert.ok(out.errors.length >= 1);

  const err = lastError(out) as any;
  assert.equal(err.stage, "PLANNING");
  assert.equal(err.severity, "HALT");

  // On fail-closed, planningId must not be created
  assert.equal(out.ids.planningId, undefined);
});
