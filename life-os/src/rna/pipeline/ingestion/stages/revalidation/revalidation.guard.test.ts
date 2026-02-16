import { test, expect } from "vitest";

import { guardRevalidation } from "#/rna/pipeline/ingestion/stages/revalidation/revalidation.guard";
import { makeEnv as makeEnvUtil, resetStagesUpTo } from "#/shared/test-utils";

const makeEnv = () => resetStagesUpTo("revalidation", makeEnvUtil());

//////////////////// Guard
test("guardRevalidation returns ok:false INVALID_REVALIDATION_INPUT when input shape is wrong", () => {
  const result = guardRevalidation({ nope: true } as any);

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.code).toBe("INVALID_REVALIDATION_INPUT");
    expect(typeof result.message).toBe("string");
    expect(result.trace).toBeTruthy();
    expect(result.trace.mode).toBe("UNKNOWN");
  }
});

test("guardRevalidation returns ok:false when required plucked fields are missing (parse fails)", () => {
  const env = makeEnv();

  // break a required field for schema parsing
  env.ids.snapshotId = undefined;

  const result = guardRevalidation(env as any);

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.code).toBe("INVALID_REVALIDATION_INPUT");
    expect(result.trace.rulesApplied).toContain("PARSE_FAILED");
  }
});

test("guardRevalidation returns ok:true and plucks + parses the expected fields", () => {
  const env = makeEnv();
  const result = guardRevalidation(env as any);

  expect(result.ok).toBeTruthy();

  if (result.ok) {
    expect(result.data.proposalId).toBe(env.ids.proposalId);
    expect(result.data.snapshotId).toBe(env.ids.snapshotId);
    expect(result.data.executionId).toBe(env.ids.executionId);
    expect(result.data.planningId).toBe(env.ids.planningId);

    // from stages.validation.validationId
    expect(result.data.validationDecision).toBe("validation_1");

    // plan should be the modeled plan (not string[])
    expect(result.data.plan).toEqual((env.stages.planning as any).plan);

    // commitPolicy must be present + typed
    expect(result.data.commitPolicy).toEqual({
      allowedModes: ["FULL"],
    });

    // effectsLog should be an object
    expect(result.data.effectsLog).toEqual(
      (env.stages.execution as any).effectsLog,
    );
  }
});
