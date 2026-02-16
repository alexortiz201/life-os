import { test, describe, it, expect } from "vitest";

import { revalidationStage } from "#/rna/pipeline/ingestion/stages/revalidation/revalidation.stage";
import {
  makeEnv as makeEnvUtil,
  resetStagesUpTo,
  lastError,
  makeValidEffectsLog,
  unwrapRight,
  unwrapLeft,
} from "#/shared/test-utils";

const makeEnv = () => resetStagesUpTo("revalidation", makeEnvUtil());

test("appends HALT error when execution stage has not run", () => {
  const env = makeEnv();
  env.stages.execution = { hasRun: false } as any;

  const out = revalidationStage(env);
  const nextEnv = unwrapLeft(out);

  expect(nextEnv.env.stages.revalidation.hasRun).toBeFalsy();
  expect(nextEnv.env.errors.length >= 1).toBeTruthy();

  const err = lastError(nextEnv.env) as any;
  expect(err.stage).toBe("REVALIDATION");
  expect(err.severity).toBe("HALT");
  expect(err.code).toBe("REVALIDATION_PREREQ_MISSING");
});

test("appends HALT error when validation stage has not run (commitPolicy missing)", () => {
  const env = makeEnv();
  env.stages.validation = { hasRun: false } as any;

  const out = revalidationStage(env);
  const nextEnv = unwrapLeft(out);

  expect(nextEnv.env.stages.revalidation.hasRun).toBeFalsy();
  expect(nextEnv.env.errors.length >= 1).toBeTruthy();

  const err = lastError(nextEnv.env) as any;
  expect(err.stage).toBe("REVALIDATION");
  expect(err.severity).toBe("HALT");
  expect(err.code).toBe("REVALIDATION_PREREQ_MISSING");
});

test("appends HALT error when snapshotId missing", () => {
  const env = makeEnv();
  env.ids.snapshotId = undefined;

  const out = revalidationStage(env);
  const nextEnv = unwrapLeft(out);

  expect(nextEnv.env.stages.revalidation.hasRun).toBeFalsy();
  expect(nextEnv.env.errors.length >= 1).toBeTruthy();

  const err = lastError(nextEnv.env) as any;
  expect(err.stage).toBe("REVALIDATION");
  expect(err.severity).toBe("HALT");
  expect(err.code).toBe("REVALIDATION_PREREQ_MISSING");
});

test("appends HALT error when effectsLogId missing", () => {
  const env = makeEnv();
  env.ids.effectsLogId = undefined;

  const out = revalidationStage(env);
  const nextEnv = unwrapLeft(out);

  expect(nextEnv.env.stages.revalidation.hasRun).toBeFalsy();
  expect(nextEnv.env.errors.length >= 1).toBeTruthy();

  const err = lastError(nextEnv.env) as any;
  expect(err.stage).toBe("REVALIDATION");
  expect(err.severity).toBe("HALT");
  expect(err.code).toBe("REVALIDATION_PREREQ_MISSING");
});

test("APPROVE_COMMIT when only ARTIFACT effects are present", () => {
  const env = makeEnv();
  const out = revalidationStage(env);
  const nextEnv = unwrapRight(out);

  expect(nextEnv.errors.length).toBe(0);
  expect(nextEnv.stages.revalidation.hasRun).toBeTruthy();

  const r = nextEnv.stages.revalidation as any;
  expect(r.proposalId).toBe("proposal_1");
  expect(r.directive.outcome).toBe("APPROVE_COMMIT");
  expect(r.directive.commitAllowList).toEqual([]);
});

test("REJECT_COMMIT on drift (effectsLog.proposalId mismatch)", () => {
  const env = makeEnv();

  (env.stages.execution as any).effectsLog = {
    effectsLogId: "effects_1",
    proposalId: "proposal_X",
    producedEffects: [],
    fingerprint: "drift_print",
  };

  const out = revalidationStage(env);
  const nextEnv = unwrapRight(out);

  // drift is a valid output (not an error)
  expect(nextEnv.errors.length).toBe(0);
  expect(nextEnv.stages.revalidation.hasRun).toBeTruthy();

  const r = nextEnv.stages.revalidation as any;
  expect(r.directive.outcome).toBe("REJECT_COMMIT");
  expect(r.directive.rulesApplied).toBeInstanceOf(Array);
  expect(r.directive.rulesApplied).toContain("DRIFT_DETECTED");
});

test("PARTIAL_NOT_ALLOWED when non-artifact effects exist and policy is FULL-only", () => {
  const env = makeEnv();

  (env.stages.validation as any) = {
    ...(env.stages.validation as any),
    hasRun: true,
    commitPolicy: { allowedModes: ["FULL"] as const },
  };

  (env.stages.execution as any).effectsLog = makeValidEffectsLog({
    effectsLogId: "effects_1",
    proposalId: "proposal_1",
    producedEffects: [
      {
        stableId: "producedEffect_1",
        effectType: "EVENT",
        eventName: "PIPELINE_TRIGGER",
        trust: "PROVISIONAL",
        payload: { foo: "bar" },
      },
      {
        stableId: "producedEffect_2",
        effectType: "ARTIFACT",
        objectId: "note_1",
        kind: "NOTE",
        trust: "PROVISIONAL",
      },
    ],
  });

  const out = revalidationStage(env);
  const nextEnv = unwrapLeft(out);

  expect(nextEnv.env.stages.revalidation.hasRun).toBeFalsy();
  expect(nextEnv.env.errors.length >= 1).toBeTruthy();

  const err = lastError(nextEnv.env) as any;
  expect(err.stage).toBe("REVALIDATION");
  expect(err.severity).toBe("HALT");
  expect(err.code).toBe("PARTIAL_NOT_ALLOWED");
});

test("PARTIAL_COMMIT when non-artifact effects exist and policy allows PARTIAL", () => {
  const env = makeEnv();

  (env.stages.validation as any) = {
    ...(env.stages.validation as any),
    hasRun: true,
    commitPolicy: { allowedModes: ["FULL", "PARTIAL"] as const },
  };

  (env.stages.execution as any).effectsLog = makeValidEffectsLog({
    effectsLogId: "effects_1",
    proposalId: "proposal_1",
    producedEffects: [
      {
        stableId: "producedEffect_1",
        effectType: "EVENT",
        eventName: "PIPELINE_TRIGGER",
        trust: "PROVISIONAL",
      },
      {
        stableId: "producedEffect_2",
        effectType: "ARTIFACT",
        objectId: "note_1",
        kind: "NOTE",
        trust: "PROVISIONAL",
      },
      {
        stableId: "producedEffect_3",
        effectType: "ARTIFACT",
        objectId: "note_2",
        kind: "NOTE",
        trust: "COMMITTED",
      },
    ],
  });

  const out = revalidationStage(env);
  const nextEnv = unwrapRight(out);

  expect(nextEnv.errors.length).toBe(0);
  expect(nextEnv.stages.revalidation.hasRun).toBeTruthy();

  const r = nextEnv.stages.revalidation as any;
  expect(r.directive.outcome).toBe("PARTIAL_COMMIT");
  expect(r.directive.commitAllowList.sort()).toEqual(["note_1"]);
});
