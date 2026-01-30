import test from "node:test";
import assert from "node:assert/strict";

import { validationStage } from "#/rna/pipeline/ingestion/stages/validation/validation.stage";
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";
import {
  makeEnv,
  resetStagesUpTo,
  lastError,
  unwrapLeft,
  unwrapRight,
  clone,
} from "#/shared/test-utils";

const makeValidationEnv = () => resetStagesUpTo("validation", makeEnv());

test("appends HALT error when proposalId missing (fail closed)", () => {
  const env = makeValidationEnv();
  (env.ids.proposalId as any) = "";

  const out = validationStage(env);
  const left = unwrapLeft(out);

  assert.equal(left.env.stages.validation.hasRun, false);
  assert.ok(left.env.errors.length >= 1);

  const err = lastError(left.env) as any;
  assert.equal(err.stage, "VALIDATION");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "VALIDATION_PREREQ_MISSING");
});

test("appends HALT error when snapshotId missing (context snapshot required)", () => {
  const env = makeValidationEnv();
  delete (env.ids as any).snapshotId;

  const out = validationStage(env);
  const left = unwrapLeft(out);

  assert.equal(left.env.stages.validation.hasRun, false);
  assert.ok(left.env.errors.length >= 1);

  const err = lastError(left.env) as any;
  assert.equal(err.stage, "VALIDATION");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "VALIDATION_PREREQ_MISSING");
});

test("writes a deterministic, untrusted decision artifact and does not create downstream artifacts", () => {
  const env = makeValidationEnv();

  const out = validationStage(env);
  const nextEnv = unwrapRight(out);

  assert.equal(nextEnv.errors.length, 0);
  assert.equal(nextEnv.stages.validation.hasRun, true);

  // must write validationId
  assert.equal(typeof nextEnv.ids.validationId, "string");
  assert.ok(nextEnv.ids.validationId);
  assert.ok(nextEnv.ids.validationId.length > 0);

  const v = nextEnv.stages.validation as any;

  // contract: explicit decision artifact
  assert.equal(v.validationId, nextEnv.ids.validationId);
  assert.equal(v.observed.proposalId, nextEnv.ids.proposalId);

  // decision_type must be one of the allowed outcomes
  assert.ok(
    ["APPROVE", "REJECT", "PARTIAL_APPROVE", "ESCALATE"].includes(
      v.decisionType,
    ),
  );

  // must include explainability / attribution / timestamp fields
  assert.equal(typeof v.decidedAt, "number");
  assert.ok(v.justification);
  assert.ok(v.attribution);

  // trust model: decision must not be COMMITTED (if present)
  if (typeof v.trust === "string") {
    assert.notEqual(v.trust, "COMMITTED");
  }

  // forbidden side effects: must not create planning output
  assert.equal((nextEnv.stages.planning as any)?.hasRun, false);
  assert.equal(nextEnv.ids.planningId, undefined);

  // forbidden side effects: must not create execution output/effects
  assert.equal((nextEnv.stages.execution as any)?.hasRun, false);
  assert.equal(nextEnv.ids.executionId, undefined);
  assert.equal(nextEnv.ids.effectsLogId, undefined);
  assert.equal((nextEnv.stages.execution as any)?.effectsLog, undefined);
});

test("no permissions allowed => HALT with SNAPSHOT_PERMISSION_NOT_ALLOWED and no advancement", () => {
  const env = makeValidationEnv();

  // force the rule: permissions.allow must be non-empty
  (env as any).snapshot = {
    permissions: {
      actor: { actorId: "user_1", actorType: "USER" },
      allow: [] as const,
    },
    invariantsVersion: "v1",
    scope: { allowedKinds: [] },
    timestamp: 1234567890,
  };

  const out = validationStage(env);
  const left = unwrapLeft(out);

  assert.ok(left.env.errors.length >= 1);

  const err = lastError(left.env) as any;
  assert.equal(err.stage, "VALIDATION");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "SNAPSHOT_PERMISSION_NOT_ALLOWED");

  // must not advance to planning
  assert.equal((left.env.stages.planning as any)?.hasRun, false);
  assert.equal(left.env.ids.planningId, undefined);
});

test("validation is deterministic for identical inputs (decision + constraints match)", () => {
  const env1 = makeValidationEnv();
  const env2 = clone(env1);

  (env2 as any).snapshot = clone((env1 as any).snapshot);

  const out1 = validationStage(env1);
  const out2 = validationStage(env2);

  const next1 = unwrapRight(out1);
  const next2 = unwrapRight(out2);

  assert.equal(next1.errors.length, 0);
  assert.equal(next2.errors.length, 0);

  const v1 = next1.stages.validation as any;
  const v2 = next2.stages.validation as any;

  assert.equal(v1.decisionType, v2.decisionType);

  // if partial, constraints must match as well
  if (v1.decisionType === "PARTIAL_APPROVE") {
    assert.deepEqual(v1.constraints, v2.constraints);
  }

  // must not affect downstream stages
  assert.equal((next1.stages.planning as any)?.hasRun, false);
  assert.equal((next2.stages.planning as any)?.hasRun, false);
});

test("validation does not mutate other stages or ids (safe to repeat)", () => {
  const env = makeValidationEnv();
  const beforePlanning = clone(env.stages.planning as any);
  const beforeIds = clone(env.ids);

  const out = validationStage(env);

  // depending on env.snapshot.permissions.allow, this might be Left or Right
  const nextEnv = ((): IngestionPipelineEnvelope => {
    try {
      return unwrapRight(out);
    } catch {
      return unwrapLeft(out).env;
    }
  })();

  // regardless of outcome, validation must not write planning/execution ids
  assert.deepEqual(nextEnv.stages.planning as any, beforePlanning);
  assert.equal(nextEnv.ids.planningId, beforeIds.planningId);
  assert.equal(nextEnv.ids.executionId, beforeIds.executionId);
  assert.equal(nextEnv.ids.effectsLogId, beforeIds.effectsLogId);
});
