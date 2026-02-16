import { test, expect } from "vitest";

import { planningStage } from "#/rna/pipeline/ingestion/stages/planning/planning.stage";
import {
  makeEnv as makeEnvUtil,
  resetStagesUpTo,
  clone,
  unwrapRight,
  unwrapLeft,
} from "#/shared/test-utils";

const makeEnv = () => resetStagesUpTo("planning", makeEnvUtil());

test("returns Left(HALT) when validation stage has not run", () => {
  const env = resetStagesUpTo("validation", makeEnvUtil());
  const out = planningStage(env);
  const left = unwrapLeft(out) as any;

  // env is carried on the Left
  expect(left.env.stages.planning.hasRun).toBeFalsy();
  expect(left.env.errors.length >= 1).toBeTruthy();

  // prefer the structured error on StageLeft
  expect(left.error.stage).toBe("PLANNING");
  expect(left.error.severity).toBe("HALT");
  expect(left.error.code).toBe("PLANNING_PREREQ_MISSING");
});

test("returns Left(HALT) when proposalId missing", () => {
  const env = makeEnv();
  env.ids.proposalId = "" as any;

  const out = planningStage(env);
  const left = unwrapLeft(out) as any;

  expect(left.env.stages.planning.hasRun).toBeFalsy();
  expect(left.env.errors.length >= 1).toBeTruthy();

  expect(left.error.stage).toBe("PLANNING");
  expect(left.error.severity).toBe("HALT");
  expect(left.error.code).toBe("PLANNING_PREREQ_MISSING");
});

test("returns Left(HALT) when snapshotId missing (plan must be pinned to a snapshot)", () => {
  const env = makeEnv();
  env.ids.snapshotId = undefined;

  const out = planningStage(env);
  const left = unwrapLeft(out) as any;

  expect(left.env.stages.planning.hasRun).toBeFalsy();
  expect(left.env.errors.length >= 1).toBeTruthy();

  expect(left.error.stage).toBe("PLANNING");
  expect(left.error.severity).toBe("HALT");
  expect(left.error.code).toBe("PLANNING_PREREQ_MISSING");
});

test("writes a deterministic, untrusted plan artifact and does not execute", () => {
  const env = makeEnv();
  env.stages.execution = { hasRun: false };
  delete (env.ids as any).effectsLogId;

  const out = planningStage(env);
  const nextEnv = unwrapRight(out);

  expect(nextEnv.errors.length).toBe(0);
  expect(nextEnv.stages.planning.hasRun).toBeTruthy();

  // Must write a planningId
  expect(typeof nextEnv.ids.planningId).toBe("string");
  expect((nextEnv.ids.planningId as any).length).toBeGreaterThan(0);

  const p = nextEnv.stages.planning as any;

  // Must write plan artifact fields (shape-level expectations)
  expect(p.planningId).toBe(nextEnv.ids.planningId);
  expect(typeof p.ranAt).toBe("number");
  expect(p.plan).toBeInstanceOf(Array);

  // Must include a deterministic fingerprint field (contract)
  const fp = p.planFingerprint ?? p.fingerprint;
  expect(typeof fp).toBe("string");
  expect(fp.length > 0).toBeTruthy();

  // Planning is descriptive: must not flip execution on
  expect((nextEnv.stages.execution as any)?.hasRun).toBeFalsy();

  // Planning must not create effects log ids
  expect((nextEnv.ids as any).effectsLogId).toBeUndefined();

  // Planning must not create producedEffects anywhere
  expect((nextEnv.stages.planning as any)?.effectsLog).toBeUndefined();
  expect((nextEnv.stages.execution as any)?.effectsLog).toBeUndefined();

  // Planning must not create COMMITTED artifacts (trust escalation forbidden)
  if (typeof p.trust === "string") {
    expect(p.trust).not.toBe("COMMITTED");
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

  expect(nextEnv.errors.length).toBe(0);
  expect(nextEnv.stages.planning.hasRun).toBeTruthy();

  const after = nextEnv.stages.validation as any;
  expect(after).toEqual(before);
});

test("identical inputs produce identical plans and fingerprints (determinism invariant)", () => {
  const env1 = makeEnv();
  const env2 = clone(env1);

  const out1 = planningStage(env1);
  const out2 = planningStage(env2);

  const e1 = unwrapRight(out1);
  const e2 = unwrapRight(out2);

  expect(e1.errors.length).toBe(0);
  expect(e2.errors.length).toBe(0);

  const p1 = e1.stages.planning as any;
  const p2 = e2.stages.planning as any;

  const fp1 = p1.planFingerprint ?? p1.fingerprint;
  const fp2 = p2.planFingerprint ?? p2.fingerprint;

  expect(fp1).toBe(fp2);
  expect(p1.plan).toEqual(p2.plan);
});

test("planning failure fails closed (no advancement / no planningId)", () => {
  const env = makeEnv();
  env.ids.proposalId = "";

  const out = planningStage(env);
  const left = unwrapLeft(out) as any;

  expect(left.env.stages.planning.hasRun).toBeFalsy();
  expect(left.env.errors.length >= 1).toBeTruthy();

  expect(left.error.stage).toBe("PLANNING");
  expect(left.error.severity).toBe("HALT");

  // On fail-closed, planningId must not be created
  expect(left.env.ids.planningId).toBeUndefined();
});
