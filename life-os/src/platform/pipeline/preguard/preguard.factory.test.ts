// guard-utils.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import { preGuardFactory } from "#/platform/pipeline/preguard/preguard.factory";

import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";
import {
  makeEnv as makeEnvUtils,
  resetStagesUpTo,
} from "../../../shared/test-utils";

const makeEnv = () => {
  const env = makeEnvUtils();

  resetStagesUpTo("planning", env);

  return env;
};

function lastError(env: IngestionPipelineEnvelope) {
  return env.errors[env.errors.length - 1];
}

test("preGuardFactory: for PLANNING, appends HALT when VALIDATION has not run", () => {
  const pre = preGuardFactory({
    STAGE: "PLANNING",
    CODE: "PLANNING_PREREQ_MISSING",
  } as const);

  const env = makeEnv();
  (env.stages.validation as any) = {
    ...(env.stages.validation as any),
    hasRun: false,
  };

  const result = pre(env);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.env.errors.length >= 1);

    const err = lastError(result.env) as any;
    assert.equal(err.stage, "PLANNING");
    assert.equal(err.severity, "HALT");
    assert.equal(err.code, "PLANNING_PREREQ_MISSING");
    assert.equal(err.trace?.proposalId, env.ids.proposalId);
  }
});

test("preGuardFactory: for PLANNING, appends HALT when required id is missing (validationId)", () => {
  const pre = preGuardFactory({
    STAGE: "PLANNING",
    CODE: "PLANNING_PREREQ_MISSING",
  } as const);

  const env = makeEnv();
  (env.stages.validation as any) = {
    ...(env.stages.validation as any),
    hasRun: true,
  };

  // deps for PLANNING require validationId
  env.ids.validationId = undefined;

  const result = pre(env);

  assert.equal(result.ok, false);
  if (!result.ok) {
    const err = lastError(result.env) as any;
    assert.equal(err.stage, "PLANNING");
    assert.equal(err.severity, "HALT");
    assert.equal(err.code, "PLANNING_PREREQ_MISSING");
    assert.equal(err.trace?.proposalId, env.ids.proposalId);
    assert.equal(err.trace?.idKey, "validationId");
    assert.equal(err.trace?.value, undefined);
  }
});

test("preGuardFactory: returns ok:true when deps satisfied (PLANNING requires VALIDATION + ids)", () => {
  const pre = preGuardFactory({
    STAGE: "PLANNING",
    CODE: "PLANNING_PREREQ_MISSING",
  } as const);

  const env = makeEnv();
  (env.stages.validation as any) = {
    ...(env.stages.validation as any),
    hasRun: true,
  };

  // ensure required ids exist
  env.ids.proposalId = env.ids.proposalId || "proposal_1";
  env.ids.validationId = env.ids.validationId || "validation_1";
  env.ids.snapshotId = env.ids.snapshotId || "snapshot_1";

  const beforeErrorsLen = env.errors.length;

  const result = pre(env);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.env, env);
    assert.equal(result.env.errors.length, beforeErrorsLen);
  }
});
