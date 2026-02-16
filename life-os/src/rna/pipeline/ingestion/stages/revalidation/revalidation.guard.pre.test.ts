import { test, describe, it, expect } from "vitest";

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

  expect(res.ok).toBeFalsy();
  if (!res.ok) {
    expect(res.env.errors.length >= 1).toBeTruthy();

    const err = lastError(res.env) as any;
    expect(err.stage).toBe("REVALIDATION");
    expect(err.severity).toBe("HALT");
    expect(err.code).toBe("REVALIDATION_PREREQ_MISSING");

    // trace contract: should explain what failed (shape may vary)
    expect(err.trace).toBeTruthy();
    expect(err.trace.proposalId).toBe(env.ids.proposalId);
    expect(
      ["executionHasRun", "stageKey", "dependsOn"].some((k) => k in err.trace),
    ).toBe(true);
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

  expect(res.ok).toBeFalsy();
  if (!res.ok) {
    const err = lastError(res.env) as any;

    expect(err.stage).toBe("REVALIDATION");
    expect(err.severity).toBe("HALT");
    expect(err.code).toBe("REVALIDATION_PREREQ_MISSING");

    expect(err.trace).toBeTruthy();
    expect(err.trace.proposalId).toBe(env.ids.proposalId);
    expect(
      ["validationHasRun", "stageKey", "dependsOn"].some((k) => k in err.trace),
    ).toBe(true);
  }
});

test("guardPreRevalidation: HALT when snapshotId missing", () => {
  const env = makeEnv();

  // prereq violated
  env.ids.snapshotId = undefined;

  const res = guardPreRevalidation(env);

  expect(res.ok).toBeFalsy();
  if (!res.ok) {
    const err = lastError(res.env) as any;

    expect(err.stage).toBe("REVALIDATION");
    expect(err.severity).toBe("HALT");
    expect(err.code).toBe("REVALIDATION_PREREQ_MISSING");

    expect(err.trace).toBeTruthy();
    expect(err.trace.proposalId).toBe(env.ids.proposalId);

    // many of your preguards use { idKey, value } pattern
    if ("idKey" in err.trace) {
      expect(err.trace.idKey).toBe("snapshotId");
    }
  }
});

test("guardPreRevalidation: HALT when effectsLogId missing", () => {
  const env = makeEnv();

  // prereq violated
  env.ids.effectsLogId = undefined;

  const res = guardPreRevalidation(env);

  expect(res.ok).toBeFalsy();
  if (!res.ok) {
    const err = lastError(res.env) as any;

    expect(err.stage).toBe("REVALIDATION");
    expect(err.severity).toBe("HALT");
    expect(err.code).toBe("REVALIDATION_PREREQ_MISSING");

    expect(err.trace).toBeTruthy();
    expect(err.trace.proposalId).toBe(env.ids.proposalId);

    if ("idKey" in err.trace) {
      expect(err.trace.idKey).toBe("effectsLogId");
    }
  }
});

test("guardPreRevalidation: ok:true when prereqs satisfied", () => {
  const env = makeEnv();
  const res = guardPreRevalidation(env);

  expect(res.ok).toBeTruthy();
  if (res.ok) {
    // should be identity on env
    expect(res.env).toBe(env);
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

  expect(res.ok).toBeFalsy();
  if (!res.ok) {
    // prereq guard should only append an error; it should not write success outputs
    expect((res.env.stages.revalidation as any)?.hasRun).toBe(beforeHasRun);
    expect(res.env.ids.revalidationId).toBe(beforeRevalidationId);
  }
});
