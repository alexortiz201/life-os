// guard-utils.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import {
  guardFactory,
  preGuardFactory,
} from "#/rna/pipelines/pipeline-utils/guard-utils";
import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";
import { makeEnv } from "../../../utils";

function lastError(env: IngestionPipelineEnvelope) {
  return env.errors[env.errors.length - 1];
}

test("guardFactory: returns ok:false when env is not an object (parseFailedRule applied)", () => {
  const InputSchema = z.object({ proposalId: z.string() });

  const guard = guardFactory({
    STAGE: "PLANNING",
    InputSchema,
    code: "INVALID_PLANNING_INPUT",
    parseFailedRule: "PARSE_FAILED",
    getCandidate: () => ({ proposalId: "x" }),
  });

  const result = guard(null as any);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "INVALID_PLANNING_INPUT");
    assert.equal(result.stage, "PLANNING");
    assert.equal(result.trace.mode, "UNKNOWN");
    assert.ok(result.trace.rulesApplied.includes("PARSE_FAILED"));
  }
});

test("guardFactory: returns ok:false when ids/stages/proposalId missing (fail closed)", () => {
  const InputSchema = z.object({ proposalId: z.string() });

  const guard = guardFactory({
    STAGE: "PLANNING",
    InputSchema,
    code: "INVALID_PLANNING_INPUT",
    parseFailedRule: "PARSE_FAILED",
    getCandidate: () => ({ proposalId: "x" }),
  });

  const env = makeEnv() as any;
  delete env.ids;

  const result = guard(env);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "INVALID_PLANNING_INPUT");
    assert.equal(result.stage, "PLANNING");
    assert.equal(result.trace.mode, "UNKNOWN");
    assert.ok(result.trace.rulesApplied.includes("PARSE_FAILED"));
  }
});

test("guardFactory: returns ok:false when prereq stage object is missing (dependency gate)", () => {
  const InputSchema = z.object({ proposalId: z.string() });

  const guard = guardFactory({
    // PLANNING depends on VALIDATION per PREV_STAGES_DEPS
    STAGE: "PLANNING",
    InputSchema,
    code: "INVALID_PLANNING_INPUT",
    parseFailedRule: "PARSE_FAILED",
    getCandidate: ({ proposalId }) => ({ proposalId }),
  });

  const env = makeEnv() as any;

  // Remove the prereq stage object entirely (hasAllDepStages checks object presence)
  delete env.stages.validation;

  const result = guard(env);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "INVALID_PLANNING_INPUT");
    assert.equal(result.stage, "PLANNING");
    assert.equal(result.trace.mode, "UNKNOWN");
    assert.equal(result.trace.proposalId, env.ids.proposalId);
    assert.ok(result.trace.rulesApplied.includes("PARSE_FAILED"));
    assert.ok(typeof result.message === "string");
  }
});

test("guardFactory: returns ok:false when schema parsing fails (candidate invalid)", () => {
  const InputSchema = z.object({
    proposalId: z.string(),
    snapshotId: z.string(),
  });

  const guard = guardFactory({
    STAGE: "PLANNING",
    InputSchema,
    code: "INVALID_PLANNING_INPUT",
    parseFailedRule: "PARSE_FAILED",
    getCandidate: ({ proposalId }) => ({
      proposalId,
      // snapshotId intentionally missing to fail Zod
    }),
  });

  const env = makeEnv();
  (env.stages.validation as any) = {
    ...(env.stages.validation as any),
    hasRun: true,
  };

  const result = guard(env);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "INVALID_PLANNING_INPUT");
    assert.equal(result.stage, "PLANNING");
    assert.equal(result.trace.mode, "UNKNOWN");
    assert.equal(result.trace.proposalId, env.ids.proposalId);
    assert.ok(result.trace.rulesApplied.includes("PARSE_FAILED"));
  }
});

test("guardFactory: returns ok:true with parsed data when candidate passes schema", () => {
  const InputSchema = z.object({
    proposalId: z.string().min(1),
    snapshotId: z.string().min(1),
  });

  const guard = guardFactory({
    STAGE: "PLANNING",
    InputSchema,
    code: "INVALID_PLANNING_INPUT",
    parseFailedRule: "PARSE_FAILED",
    getCandidate: ({ ids, proposalId }) => ({
      proposalId,
      snapshotId: ids.snapshotId,
    }),
  });

  const env = makeEnv();
  (env.stages.validation as any) = {
    ...(env.stages.validation as any),
    hasRun: true,
  };

  const result = guard(env);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.data, {
      proposalId: env.ids.proposalId,
      snapshotId: env.ids.snapshotId,
    });
  }
});

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
