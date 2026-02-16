// guard-utils.test.ts
import { test, describe, it, expect } from "vitest";

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

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.env.errors.length >= 1).toBeTruthy();

    const err = lastError(result.env) as any;
    expect(err.stage).toBe("PLANNING");
    expect(err.severity).toBe("HALT");
    expect(err.code).toBe("PLANNING_PREREQ_MISSING");
    expect(err.trace?.proposalId).toBe(env.ids.proposalId);
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

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    const err = lastError(result.env) as any;
    expect(err.stage).toBe("PLANNING");
    expect(err.severity).toBe("HALT");
    expect(err.code).toBe("PLANNING_PREREQ_MISSING");
    expect(err.trace?.proposalId).toBe(env.ids.proposalId);
    expect(err.trace?.idKey).toBe("validationId");
    expect(err.trace?.value).toBeUndefined();
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

  expect(result.ok).toBeTruthy();
  if (result.ok) {
    expect(result.env).toBe(env);
    expect(result.env.errors.length).toBe(beforeErrorsLen);
  }
});
