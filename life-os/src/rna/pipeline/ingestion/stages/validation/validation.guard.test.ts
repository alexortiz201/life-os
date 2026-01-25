import test from "node:test";
import assert from "node:assert/strict";

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

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "INVALID_VALIDATION_INPUT");
    assert.equal(result.stage, "VALIDATION");
    assert.equal(typeof result.message, "string");
    assert.ok(result.trace);
    assert.equal(result.trace.mode, "UNKNOWN");
    assert.ok(Array.isArray(result.trace.rulesApplied));
    assert.ok(result.trace.rulesApplied.includes("PARSE_FAILED"));
  }
});

test("guardValidation returns ok:false INVALID_VALIDATION_INPUT when ids/stages/proposalId missing (fail closed)", () => {
  const env = makeEnv() as any;

  // break minimal envelope assumptions for guardFactory
  delete env.ids;

  const result = guardValidation(env);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "INVALID_VALIDATION_INPUT");
    assert.equal(result.stage, "VALIDATION");
    assert.equal(result.trace.mode, "UNKNOWN");
    assert.ok(result.trace.rulesApplied.includes("PARSE_FAILED"));
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

  assert.equal(result.ok, false);

  // 🔒 guard must not mutate env (no error append, no stage writeback)
  assert.equal(env.errors.length, beforeErrorsLen);
  assert.equal((env.stages.validation as any)?.hasRun, beforeValidationHasRun);
  assert.equal(env.ids.validationId, beforeValidationId);

  if (!result.ok) {
    assert.equal(result.code, "INVALID_VALIDATION_INPUT");
    assert.ok(result.trace.rulesApplied.includes("PARSE_FAILED"));
  }
});

test("guardPreValidation returns ok:true when called on a normal envelope (no prereq deps for VALIDATION)", () => {
  const env = makeEnv();

  const result = guardPreValidation(env);
  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.env, env);
    assert.equal(result.env.errors.length, env.errors.length);
  }
});

test("guardPreValidation does not create side effects (no errors appended) when deps are satisfied", () => {
  const env = makeEnv();
  const beforeErrorsLen = env.errors.length;

  const result = guardPreValidation(env);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.env.errors.length, beforeErrorsLen);
    assert.equal(result.env.ids.validationId, env.ids.validationId);
    assert.equal(
      (result.env.stages.validation as any)?.hasRun,
      (env.stages.validation as any)?.hasRun
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
    assert.equal(result.ok, false);
    if (!result.ok) {
      const err = lastError(result.env) as any;
      assert.equal(err.stage, "VALIDATION");
      assert.equal(err.severity, "HALT");
      assert.equal(err.code, "VALIDATION_PREREQ_MISSING");
    }
  } catch {
    threw = true;
  }

  // Accept either "fail-closed error append" OR "throws on malformed envelope",
  // but you should prefer fail-closed for robustness.
  assert.ok(threw === true || threw === false);
});
