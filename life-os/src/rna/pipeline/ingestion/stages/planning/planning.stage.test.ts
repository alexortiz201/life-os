import test from "node:test";
import assert from "node:assert/strict";

import * as E from "fp-ts/Either";

import { planningStage } from "#/rna/pipeline/ingestion/stages/planning/planning.stage";
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";
import { makeEnv } from "#/shared/test-utils";

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function unwrapRight<L, A>(out: E.Either<L, A>): A {
  assert.ok(E.isRight(out), "expected Right");
  return out.right;
}

function unwrapLeft<L, A>(out: E.Either<L, A>): L {
  assert.ok(E.isLeft(out), "expected Left");
  return out.left;
}

test("returns Left(HALT) when validation stage has not run", () => {
  const env = makeEnv();
  (env.stages.validation as any) = { hasRun: false };

  const out = planningStage(env);
  const left = unwrapLeft(out) as any;

  // env is carried on the Left
  assert.equal(left.env.stages.planning.hasRun, false);
  assert.ok(left.env.errors.length >= 1);

  // prefer the structured error on StageLeft
  assert.equal(left.error.stage, "PLANNING");
  assert.equal(left.error.severity, "HALT");
  assert.equal(left.error.code, "PLANNING_PREREQ_MISSING");
});

test("returns Left(HALT) when proposalId missing", () => {
  const env = makeEnv();
  env.ids.proposalId = "" as any;

  const out = planningStage(env);
  const left = unwrapLeft(out) as any;

  assert.equal(left.env.stages.planning.hasRun, false);
  assert.ok(left.env.errors.length >= 1);

  assert.equal(left.error.stage, "PLANNING");
  assert.equal(left.error.severity, "HALT");
  assert.equal(left.error.code, "PLANNING_PREREQ_MISSING");
});

test("returns Left(HALT) when snapshotId missing (plan must be pinned to a snapshot)", () => {
  const env = makeEnv();
  env.ids.snapshotId = undefined;

  const out = planningStage(env);
  const left = unwrapLeft(out) as any;

  assert.equal(left.env.stages.planning.hasRun, false);
  assert.ok(left.env.errors.length >= 1);

  assert.equal(left.error.stage, "PLANNING");
  assert.equal(left.error.severity, "HALT");
  assert.equal(left.error.code, "PLANNING_PREREQ_MISSING");
});

test("writes a deterministic, untrusted plan artifact and does not execute", () => {
  const env = makeEnv();
  env.stages.execution = { hasRun: false };
  delete (env.ids as any).effectsLogId;

  const out = planningStage(env);
  const nextEnv = unwrapRight(out);

  assert.equal(nextEnv.errors.length, 0);
  assert.equal(nextEnv.stages.planning.hasRun, true);

  // Must write a planningId
  assert.equal(typeof nextEnv.ids.planningId, "string");
  assert.ok((nextEnv.ids.planningId as any).length > 0);

  const p = nextEnv.stages.planning as any;

  // Must write plan artifact fields (shape-level expectations)
  assert.equal(p.planningId, nextEnv.ids.planningId);
  assert.equal(typeof p.ranAt, "number");
  assert.ok(Array.isArray(p.plan));

  // Must include a deterministic fingerprint field (contract)
  const fp = p.planFingerprint ?? p.fingerprint;
  assert.equal(typeof fp, "string");
  assert.ok(fp.length > 0);

  // Planning is descriptive: must not flip execution on
  assert.equal((nextEnv.stages.execution as any)?.hasRun, false);

  // Planning must not create effects log ids
  assert.equal((nextEnv.ids as any).effectsLogId, undefined);

  // Planning must not create producedEffects anywhere
  assert.equal((nextEnv.stages.planning as any)?.effectsLog, undefined);
  assert.equal((nextEnv.stages.execution as any)?.effectsLog, undefined);

  // Planning must not create COMMITTED artifacts (trust escalation forbidden)
  if (typeof p.trust === "string") {
    assert.notEqual(p.trust, "COMMITTED");
  }
});

test("planning does not mutate validation output (must honor constraints verbatim)", () => {
  const env = makeEnv();

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
  const nextEnv = unwrapRight(out);

  assert.equal(nextEnv.errors.length, 0);
  assert.equal(nextEnv.stages.planning.hasRun, true);

  const after = nextEnv.stages.validation as any;
  assert.deepEqual(after, before);
});

test("identical inputs produce identical plans and fingerprints (determinism invariant)", () => {
  const env1 = makeEnv();
  const env2 = clone(env1);

  const out1 = planningStage(env1);
  const out2 = planningStage(env2);

  const e1 = unwrapRight(out1);
  const e2 = unwrapRight(out2);

  assert.equal(e1.errors.length, 0);
  assert.equal(e2.errors.length, 0);

  const p1 = e1.stages.planning as any;
  const p2 = e2.stages.planning as any;

  const fp1 = p1.planFingerprint ?? p1.fingerprint;
  const fp2 = p2.planFingerprint ?? p2.fingerprint;

  assert.equal(fp1, fp2);
  assert.deepEqual(p1.plan, p2.plan);
});

test("planning failure fails closed (no advancement / no planningId)", () => {
  const env = makeEnv();
  env.ids.proposalId = "";

  const out = planningStage(env);
  const left = unwrapLeft(out) as any;

  assert.equal(left.env.stages.planning.hasRun, false);
  assert.ok(left.env.errors.length >= 1);

  assert.equal(left.error.stage, "PLANNING");
  assert.equal(left.error.severity, "HALT");

  // On fail-closed, planningId must not be created
  assert.equal(left.env.ids.planningId, undefined);
});
