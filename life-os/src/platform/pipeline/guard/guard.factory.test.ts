// guard-utils.test.ts
import { test, describe, it, expect } from "vitest";
import { z } from "zod";

import { guardFactory } from "#/platform/pipeline/guard/guard.factory";

import {
  makeEnv as makeEnvUtils,
  resetStagesUpTo,
} from "../../../shared/test-utils";

const makeEnv = () => {
  const env = makeEnvUtils();

  resetStagesUpTo("planning", env);

  return env;
};

test("guardFactory: returns ok:false when env is not an object (parseFailedRule applied)", () => {
  const InputSchema = z.object({ proposalId: z.string() });

  const guard = guardFactory({
    STAGE: "PLANNING",
    InputSchema,
    code: "INVALID_PLANNING_INPUT",
    parseFailedRule: "PARSE_FAILED",
    pluckParams: () => ({ proposalId: "x" }),
  });

  const result = guard(null as any);

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.code).toBe("INVALID_PLANNING_INPUT");
    expect(result.stage).toBe("PLANNING");
    expect(result.trace.mode).toBe("UNKNOWN");
    expect(result.trace.rulesApplied).toContain("PARSE_FAILED");
  }
});

test("guardFactory: returns ok:false when ids/stages/proposalId missing (fail closed)", () => {
  const InputSchema = z.object({ proposalId: z.string() });

  const guard = guardFactory({
    STAGE: "PLANNING",
    InputSchema,
    code: "INVALID_PLANNING_INPUT",
    parseFailedRule: "PARSE_FAILED",
    pluckParams: () => ({ proposalId: "x" }),
  });

  const env = makeEnv() as any;
  delete env.ids;

  const result = guard(env);

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.code).toBe("INVALID_PLANNING_INPUT");
    expect(result.stage).toBe("PLANNING");
    expect(result.trace.mode).toBe("UNKNOWN");
    expect(result.trace.rulesApplied).toContain("PARSE_FAILED");
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
    pluckParams: ({ proposalId }) => ({ proposalId }),
  });

  const env = makeEnv() as any;

  // Remove the prereq stage object entirely (hasAllDepStages checks object presence)
  delete env.stages.validation;

  const result = guard(env);

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.code).toBe("INVALID_PLANNING_INPUT");
    expect(result.stage).toBe("PLANNING");
    expect(result.trace.mode).toBe("UNKNOWN");
    expect(result.trace.proposalId).toBe(env.ids.proposalId);
    expect(result.trace.rulesApplied).toContain("PARSE_FAILED");
    expect(typeof result.message === "string").toBeTruthy();
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
    pluckParams: ({ proposalId }) =>
      ({
        proposalId,
        // snapshotId intentionally missing to fail Zod
      }) as unknown as z.input<typeof InputSchema>,
  });

  const env = makeEnv();
  (env.stages.validation as any) = {
    ...(env.stages.validation as any),
    hasRun: true,
  };

  const result = guard(env);

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.code).toBe("INVALID_PLANNING_INPUT");
    expect(result.stage).toBe("PLANNING");
    expect(result.trace.mode).toBe("UNKNOWN");
    expect(result.trace.ids.proposalId).toBe(env.ids.proposalId);
    expect(result.trace.rulesApplied).toContain("PARSE_FAILED");
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
    pluckParams: ({ ids, proposalId }) => ({
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

  expect(result.ok).toBeTruthy();
  if (result.ok) {
    expect(result.data).toEqual({
      proposalId: env.ids.proposalId,
      snapshotId: env.ids.snapshotId,
    });
  }
});
