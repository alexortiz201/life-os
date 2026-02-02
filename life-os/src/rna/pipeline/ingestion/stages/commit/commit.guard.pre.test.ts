import test from "node:test";
import assert from "node:assert/strict";

import { guardPreCommit } from "#/rna/pipeline/ingestion/stages/commit/commit.guard";

import { INGESTION_STAGE_DEPS } from "#/rna/pipeline/ingestion/ingestion.const";
import { ENVELOPE_STAGE_TO_KEY } from "#/rna/envelope/envelope.const";

import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";
import { makeEnv as makeEnvUtil, resetStagesUpTo } from "#/shared/test-utils";

const makeEnv = (patch?: any) => resetStagesUpTo("commit", makeEnvUtil(patch));

const STAGE = "COMMIT" as const;
const CODE = "COMMIT_PREREQ_MISSING" as const;

function lastError(env: IngestionPipelineEnvelope) {
  const errs = env.errors ?? [];
  assert.ok(errs.length > 0, "Expected env.errors to have at least 1 error.");
  return errs[errs.length - 1] as any;
}

test("guardPreCommit passes when all dependencies are satisfied", () => {
  const env = makeEnv();
  const res = guardPreCommit(env);

  assert.equal(res.ok, true);
});

test("guardPreCommit fails when any required dependency stage has not run", () => {
  const deps = INGESTION_STAGE_DEPS[STAGE];

  for (const depStage of deps.stages) {
    const stageKey = ENVELOPE_STAGE_TO_KEY[depStage];

    const env = makeEnv({
      stages: {
        [stageKey]: {
          ...(makeEnv().stages as any)[stageKey],
          hasRun: false,
        },
      } as any,
    });

    const res = guardPreCommit(env);

    assert.equal(res.ok, false, `Expected fail when ${depStage} not run`);
    if (!res.ok) {
      const err = lastError(res.env);

      assert.equal(err.stage, STAGE);
      assert.equal(err.code, CODE);
      assert.equal(err.severity, "HALT");

      // message is: `${stageKey} stage has not run.`
      assert.equal(err.message, `${stageKey} stage has not run.`);

      // trace includes proposalId + `${stageKey}HasRun`: false
      assert.equal(err.trace?.proposalId, env.ids.proposalId);
      assert.equal(err.trace?.[`${stageKey}HasRun`], false);
    }
  }
});

test("guardPreCommit fails when any required dependency id is missing", () => {
  const deps = INGESTION_STAGE_DEPS[STAGE];

  for (const idKey of deps.ids) {
    const stageKey = ENVELOPE_STAGE_TO_KEY[STAGE];

    const env = makeEnv({
      ids: {
        [idKey]: "", // assertIdExists checks string length > 0
      } as any,
    });

    const res = guardPreCommit(env);

    assert.equal(
      res.ok,
      false,
      `Expected fail when id ${String(idKey)} missing`,
    );
    if (!res.ok) {
      const err = lastError(res.env);

      assert.equal(err.stage, STAGE);
      assert.equal(err.code, CODE);
      assert.equal(err.severity, "HALT");

      // message comes from assertIdExists call in assertStageDependencies
      assert.equal(
        err.message,
        `Missing ${String(idKey)} required for ${stageKey}.`,
      );

      // trace includes proposalId + idKey + value
      assert.equal(err.trace?.proposalId, env.ids.proposalId);
      assert.equal(err.trace?.idKey, idKey);
      assert.equal(err.trace?.value, ""); // since we set empty string
    }
  }
});
