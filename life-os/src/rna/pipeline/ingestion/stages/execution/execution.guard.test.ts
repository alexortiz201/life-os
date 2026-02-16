import { test, describe, it, expect } from "vitest";

import {
  guardExecution,
  guardPreExecution,
} from "#/rna/pipeline/ingestion/stages/execution/execution.guard";
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";
import { makeEnv as makeEnvUtil } from "#/shared/test-utils";

function lastError(env: IngestionPipelineEnvelope) {
  return env.errors[env.errors.length - 1];
}

// Helper: cheap deep clone for env-like data
function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

const makeEnv = () =>
  makeEnvUtil({
    stages: {
      execution: { hasRun: false },
      revalidation: { hasRun: false },
      commit: { hasRun: false },
    },
  });

test("guardExecution returns ok:false INVALID_EXECUTION_INPUT when input shape is wrong", () => {
  const result = guardExecution({ nope: true } as any);

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.code).toBe("INVALID_EXECUTION_INPUT");
    expect(typeof result.message).toBe("string");
    expect(result.trace).toBeTruthy();
    expect(result.trace.mode).toBe("UNKNOWN");
    expect(result.trace.rulesApplied).toBeInstanceOf(Array);
    expect(result.trace.rulesApplied).toContain("PARSE_FAILED");
  }
});

test("guardExecution is pure: does not append errors or mutate env", () => {
  const env = makeEnv();

  // break something to force failure
  (env.ids as any).proposalId = "";

  const before = clone(env);
  const result = guardExecution(env as any);

  expect(result.ok).toBeFalsy();

  // 🔒 pure: guard must not mutate env at all
  expect(env).toEqual(before);
});

test("guardExecution does not enforce prereqs (missing planning/snapshotId does not append errors)", () => {
  const env = makeEnv();
  const beforeErrorsLen = env.errors.length;

  // prereqs are guardPreExecution's job, not guardExecution's job
  (env.stages.planning as any) = { hasRun: false };
  env.ids.snapshotId = undefined;

  const result = guardExecution(env as any);

  // It may return ok:false depending on schema,
  // but it must not append errors to env.
  expect(env.errors.length).toBe(beforeErrorsLen);

  if (!result.ok) {
    expect(result.code).toBe("INVALID_EXECUTION_INPUT");
    expect(result.trace.rulesApplied).toContain("PARSE_FAILED");
  }
});

test("guardExecution returns ok:true and plucks canonical inputs when schema passes", () => {
  const env = makeEnv();
  const result = guardExecution(env as any);

  expect(result.ok).toBeTruthy();
  if (result.ok) {
    expect(result.data.proposalId).toBe(env.ids.proposalId);
    expect(result.data.snapshotId).toBe(env.ids.snapshotId);

    // pluck: validationDecision should come from validation.validationId per pluckParams
    expect(result.data.validationDecision).toBe(
      (env.stages.validation as any).validationId,
    );

    // pluck: planningId should come from ids
    expect(result.data.planningId).toBe(env.ids.planningId);

    // ✅ critical: plan should come from planning stage, not validation stage
    const plan = result.data.plan;

    expect(plan.length).toBe(2);

    expect(plan[0].stepId).toBe("step_1");
    expect(plan[0].kind).toBe("PRODUCE_ARTIFACT");
    expect(plan[0].outputs.artifacts).toEqual([{ kind: "NOTE" }]);

    expect(plan[1].stepId).toBe("step_2");
    expect(plan[1].kind).toBe("EMIT_EVENT");
    expect(plan[1].outputs.events).toEqual([{ name: "REFLECTION_READY" }]);

    // commitPolicy should come from validation
    expect(result.data.commitPolicy).toEqual(
      (env.stages.validation as any).commitPolicy,
    );
  }
});

///////////////// guardPreExecution //////////////////

test("guardPreExecution appends HALT error when planning stage has not run", () => {
  const env = makeEnv();
  (env.stages.planning as any) = { hasRun: false };

  const res = guardPreExecution(env);

  expect(res.ok).toBeFalsy();
  expect(res.env.errors.length >= 1).toBeTruthy();

  const err = lastError(res.env) as any;
  expect(err.stage).toBe("EXECUTION");
  expect(err.severity).toBe("HALT");
  expect(err.code).toBe("EXECUTION_PREREQ_MISSING");

  // Keep trace assertions loose; preGuardFactory may evolve trace shape.
  expect(err.trace).toBeTruthy();
  expect(err.trace?.proposalId).toBe(env.ids.proposalId);
});

test("guardPreExecution appends HALT error when snapshotId is missing", () => {
  const env = makeEnv();
  env.ids.snapshotId = undefined;

  const res = guardPreExecution(env);

  expect(res.ok).toBeFalsy();
  expect(res.env.errors.length >= 1).toBeTruthy();

  const err = lastError(res.env) as any;
  expect(err.stage).toBe("EXECUTION");
  expect(err.severity).toBe("HALT");
  expect(err.code).toBe("EXECUTION_PREREQ_MISSING");

  expect(err.trace).toBeTruthy();
  expect(err.trace?.proposalId).toBe(env.ids.proposalId);
});

test("guardPreExecution returns ok:true when prereqs are satisfied", () => {
  const env = makeEnv();

  // satisfy typical prereqs
  env.ids.snapshotId = env.ids.snapshotId ?? "snapshot_1";

  const res = guardPreExecution(env);

  expect(res.ok).toBeTruthy();
  if (res.ok) {
    expect(res.env).toBe(env);
  }
});
