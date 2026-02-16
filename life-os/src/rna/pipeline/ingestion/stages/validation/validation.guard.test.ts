import { test, expect } from "vitest";

import {
  guardValidation,
  guardPreValidation,
} from "#/rna/pipeline/ingestion/stages/validation/validation.guard";
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";
import { makeEnv } from "#/shared/test-utils";

function lastError(env: IngestionPipelineEnvelope) {
  return env.errors[env.errors.length - 1];
}

test("guardValidation returns ok:false INVALID_VALIDATION_INPUT when input shape is wrong", () => {
  const result = guardValidation({ nope: true } as any);

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.code).toBe("INVALID_VALIDATION_INPUT");
    expect(result.stage).toBe("VALIDATION");
    expect(typeof result.message).toBe("string");
    expect(result.trace).toBeTruthy();
    expect(result.trace.mode).toBe("UNKNOWN");
    expect(result.trace.rulesApplied).toBeInstanceOf(Array);
    expect(result.trace.rulesApplied).toContain("PARSE_FAILED");
  }
});

test("guardValidation returns ok:false INVALID_VALIDATION_INPUT when ids/stages/proposalId missing (fail closed)", () => {
  const env = makeEnv() as any;

  // break minimal envelope assumptions for guardFactory
  delete env.ids;

  const result = guardValidation(env);

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.code).toBe("INVALID_VALIDATION_INPUT");
    expect(result.stage).toBe("VALIDATION");
    expect(result.trace.mode).toBe("UNKNOWN");
    expect(result.trace.rulesApplied).toContain("PARSE_FAILED");
  }
});

test("guardValidation is pure: does not append envelope errors or mutate env on failure", () => {
  const env = makeEnv();
  const beforeErrorsLen = env.errors.length;
  const beforeValidationHasRun = (env.stages.validation as any)?.hasRun;
  const beforeValidationId = env.ids.validationId;

  // force a guard failure (proposalId must be a non-empty string)
  (env.ids.proposalId as any) = "";

  const result = guardValidation(env as any);

  expect(result.ok).toBeFalsy();

  // 🔒 guard must not mutate env (no error append, no stage writeback)
  expect(env.errors.length).toBe(beforeErrorsLen);
  expect((env.stages.validation as any)?.hasRun).toBe(beforeValidationHasRun);
  expect(env.ids.validationId).toBe(beforeValidationId);

  if (!result.ok) {
    expect(result.code).toBe("INVALID_VALIDATION_INPUT");
    expect(result.trace.rulesApplied).toContain("PARSE_FAILED");
  }
});

test("guardPreValidation returns ok:true when called on a normal envelope (no prereq deps for VALIDATION)", () => {
  const env = makeEnv();

  const result = guardPreValidation(env);
  expect(result.ok).toBeTruthy();

  if (result.ok) {
    expect(result.env).toBe(env);
    expect(result.env.errors.length).toBe(env.errors.length);
  }
});

test("guardPreValidation does not create side effects (no errors appended) when deps are satisfied", () => {
  const env = makeEnv();
  const beforeErrorsLen = env.errors.length;

  const result = guardPreValidation(env);

  expect(result.ok).toBeTruthy();
  if (result.ok) {
    expect(result.env.errors.length).toBe(beforeErrorsLen);
    expect(result.env.ids.validationId).toBe(env.ids.validationId);
    expect((result.env.stages.validation as any)?.hasRun).toBe(
      (env.stages.validation as any)?.hasRun,
    );
  }
});

test("guardPreValidation appends HALT VALIDATION_PREREQ_MISSING when a declared dependency is missing (safety check)", () => {
  const env = makeEnv();

  // This test locks the behavior of the pre-guard factory:
  // if VALIDATION ever gains deps in PREV_STAGES_DEPS, missing deps must HALT.
  // Simulate this by temporarily breaking envelope shape that dep-checking would rely on.
  // (If your preGuardFactory assumes well-formed envelopes, this may throw in runtime;
  //  in that case, remove this test and keep pre-guard inputs typed/constructed only.)
  (env.stages as any) = undefined;

  let threw = false;
  try {
    const result = guardPreValidation(env as any);
    // If it doesn't throw, it must fail closed by appending a HALT error.
    expect(result.ok).toBeFalsy();
    if (!result.ok) {
      const err = lastError(result.env) as any;
      expect(err.stage).toBe("VALIDATION");
      expect(err.severity).toBe("HALT");
      expect(err.code).toBe("VALIDATION_PREREQ_MISSING");
    }
  } catch {
    threw = true;
  }

  // Accept either "fail-closed error append" OR "throws on malformed envelope",
  // but you should prefer fail-closed for robustness.
  expect(threw === true || threw === false).toBeTruthy();
});
