import { test, expect } from "vitest";

import { guardCommit } from "#/rna/pipeline/ingestion/stages/commit/commit.guard";

import { makeEnv as makeEnvUtil, resetStagesUpTo } from "#/shared/test-utils";

const makeEnv = () => resetStagesUpTo("commit", makeEnvUtil());

//////////////////// Guard (guardFactory)
test("guardCommit returns ok:false INVALID_COMMIT_INPUT when input shape is wrong", () => {
  const result = guardCommit({ nope: true } as any);

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.code).toBe("INVALID_COMMIT_INPUT");
    expect(typeof result.message).toBe("string");
    expect(result.trace).toBeTruthy();
    expect(result.trace.rulesApplied).toContain("PARSE_FAILED");
  }
});

test("guardCommit returns ok:false when required plucked fields are missing (parse fails)", () => {
  const env = makeEnv();

  // break a required field for schema parsing
  (env.ids.proposalId as any) = undefined;

  const result = guardCommit(env as any);

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.code).toBe("INVALID_COMMIT_INPUT");
    expect(result.trace.rulesApplied).toContain("PARSE_FAILED");
  }
});

test("guardCommit returns ok:false when execution.effectsLog is missing (parse fails)", () => {
  const env = makeEnv();

  // pluckParams reads effectsLog from stages.execution.effectsLog
  (env.stages.execution as any) = {
    ...(env.stages.execution as any),
    effectsLog: undefined,
  };

  const result = guardCommit(env as any);

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.code).toBe("INVALID_COMMIT_INPUT");
    expect(result.trace.rulesApplied).toContain("PARSE_FAILED");
  }
});

test("guardCommit returns ok:false when revalidation stage is missing (parse fails)", () => {
  const env = makeEnv();

  // pluckParams returns revalidation: stages.revalidation
  (env.stages as any).revalidation = undefined;

  const result = guardCommit(env as any);

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.code).toBe("INVALID_COMMIT_INPUT");
    expect(result.trace.rulesApplied).toContain("PARSE_FAILED");
  }
});

test("guardCommit returns ok:true and plucks + parses expected fields", () => {
  const env = makeEnv();

  const result = guardCommit(env as any);

  expect(result.ok).toBeTruthy();

  if (result.ok) {
    // proposalId comes from ids
    expect(result.data.proposalId).toBe(env.ids.proposalId);

    // assert shallowly not deepEqual when stubbing!!!!
    // revalidation is the entire stages.revalidation object (not directive)
    expect(result.data.revalidation.revalidationId).toBe(
      (env.stages as any).revalidation.revalidationId,
    );

    // effectsLog comes from stages.execution.effectsLog
    expect(result.data.effectsLog.effectsLogId).toBe(
      (env.stages.execution as any).effectsLog.effectsLogId,
    );
  }
});

test("guardCommit fail-closed does not mark commit stage as run or create commitId", () => {
  const env = makeEnv();

  // force parse failure
  (env.ids as any).proposalId = undefined;

  const beforeHasRun = (env.stages.commit as any)?.hasRun;
  const beforeCommitId = (env.ids as any).commitId;

  const res = guardCommit(env as any);

  expect(res.ok).toBeFalsy();
  if (!res.ok) {
    // guard should only return error; it should not write success outputs
    expect((env.stages.commit as any)?.hasRun).toBe(beforeHasRun);
    expect((env.ids as any).commitId).toBe(beforeCommitId);
  }
});
