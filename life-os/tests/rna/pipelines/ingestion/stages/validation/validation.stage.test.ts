import test from "node:test";
import assert from "node:assert/strict";

import { validationStage } from "#/rna/pipelines/ingestion/stages/validation/validation.stage";
import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";
import {
  makeEnv,
  deleteIds,
  clearDefaultIdsPastStage,
} from "../../../../../utils";

function lastError(env: IngestionPipelineEnvelope) {
  return env.errors[env.errors.length - 1];
}

// cheap deep clone for env-like data
function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function makeValidationEnv() {
  const env = makeEnv({
    stages: {
      validation: { hasRun: false },
      planning: { hasRun: false },
      execution: { hasRun: false },
      revalidation: { hasRun: false },
      commit: { hasRun: false },
    },
  });
  clearDefaultIdsPastStage("validation", env);
  return env;
}

test("appends HALT error when proposalId missing (fail closed)", () => {
  const env = makeValidationEnv();
  (env.ids.proposalId as any) = "";

  const out = validationStage(env);

  assert.equal(out.stages.validation.hasRun, false);
  assert.ok(out.errors.length >= 1);

  const err = lastError(out) as any;
  assert.equal(err.stage, "VALIDATION");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "VALIDATION_PREREQ_MISSING");
});

test("appends HALT error when snapshotId missing (context snapshot required)", () => {
  const env = makeValidationEnv();

  delete env.ids.snapshotId;

  const out = validationStage(env);

  assert.equal(out.stages.validation.hasRun, false);
  assert.ok(out.errors.length >= 1);

  const err = lastError(out) as any;
  assert.equal(err.stage, "VALIDATION");
  assert.equal(err.severity, "HALT");
  // prereq gate for VALIDATION should halt if required snapshot is missing
  assert.equal(err.code, "VALIDATION_PREREQ_MISSING");
});

test("writes a deterministic, untrusted decision artifact and does not create downstream artifacts", () => {
  const env = makeValidationEnv();
  const out = validationStage(env);

  assert.equal(out.errors.length, 0);
  assert.equal(out.stages.validation.hasRun, true);

  // must write validationId
  assert.equal(typeof out.ids.validationId, "string");
  assert.ok((out.ids.validationId as any).length > 0);

  const v = out.stages.validation as any;

  // contract: explicit decision artifact
  assert.equal(v.validationId, out.ids.validationId);
  assert.equal(v.observed.proposalId, out.ids.proposalId);

  // decision_type must be one of the allowed outcomes
  assert.ok(
    ["APPROVE", "REJECT", "PARTIAL_APPROVE", "ESCALATE"].includes(
      v.decisionType
    )
  );

  // must include explainability / attribution / timestamp fields
  assert.equal(typeof v.decidedAt, "number");
  assert.ok(v.justification);
  assert.ok(v.attribution);

  // trust model: decision is untrusted (must not be COMMITTED)
  if (typeof v.trust === "string") {
    assert.notEqual(v.trust, "COMMITTED");
  }

  // forbidden side effects: must not create planning output
  assert.equal((out.stages.planning as any)?.hasRun, false);
  assert.equal(out.ids.planningId, undefined);

  // forbidden side effects: must not create execution output/effects
  assert.equal((out.stages.execution as any)?.hasRun, false);
  assert.equal(out.ids.executionId, undefined);
  assert.equal(out.ids.effectsLogId, undefined);
  assert.equal((out.stages.execution as any)?.effectsLog, undefined);
});

test("REJECT or ESCALATE halts the pipeline (no advancement; hasRun remains false)", () => {
  const env = makeValidationEnv();

  // Force a validation outcome by injecting a proposal/context combination
  // that should not be allowed. (Adjust to your actual decision logic later.)
  (env as any).snapshot = {
    permissions: { actor: "user_1", allow: [] }, // no permissions => should REJECT or ESCALATE
    invariantsVersion: "v1",
    scope: { allowedKinds: [] },
    timestamp: 1234567890,
  };

  const out = validationStage(env);

  // Spec: HALT ON REJECT or ESCALATE (if no escalation path)
  // Implementation can either:
  //  - set hasRun=false and append HALT error
  //  - or set hasRun=true but append HALT error and prevent downstream
  // This test locks the "no advancement" behavior.
  assert.ok(out.errors.length >= 1);

  const err = lastError(out) as any;
  assert.equal(err.stage, "VALIDATION");
  assert.equal(err.severity, "HALT");

  // must not advance to planning
  assert.equal((out.stages.planning as any)?.hasRun, false);
  assert.equal(out.ids.planningId, undefined);
});

test("validation is deterministic for identical inputs (decision + constraints match)", () => {
  const env1 = makeValidationEnv();
  const env2 = clone(env1);

  (env2 as any).snapshot = clone((env1 as any).snapshot);

  const out1 = validationStage(env1);
  const out2 = validationStage(env2);

  assert.equal(out1.errors.length, 0);
  assert.equal(out2.errors.length, 0);

  const v1 = out1.stages.validation as any;
  const v2 = out2.stages.validation as any;

  assert.equal(v1.decisionType, v2.decisionType);

  // if partial, constraints must match as well
  if (v1.decisionType === "PARTIAL_APPROVE") {
    assert.deepEqual(v1.constraints, v2.constraints);
  }

  // must not affect downstream stages
  assert.equal((out1.stages.planning as any)?.hasRun, false);
  assert.equal((out2.stages.planning as any)?.hasRun, false);
});

test("validation does not mutate other stages or ids (safe to repeat)", () => {
  const env = makeValidationEnv();
  const beforePlanning = clone(env.stages.planning as any);
  const beforeIds = clone(env.ids);

  const out = validationStage(env);

  // regardless of outcome, validation must not write planning/execution ids
  assert.deepEqual(out.stages.planning as any, beforePlanning);
  assert.equal(out.ids.planningId, beforeIds.planningId);
  assert.equal(out.ids.executionId, beforeIds.executionId);
  assert.equal(out.ids.effectsLogId, beforeIds.effectsLogId);
});
