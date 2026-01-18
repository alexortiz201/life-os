// planning.guard.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  guardPlanning,
  guardPrePlanning,
} from "#/rna/pipelines/ingestion/stages/planning/planning.guard";
import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";

import { makeEnv } from "../../../../../utils";

// test("returns ok:false INVALID_PLANNING_INPUT when input shape is wrong", () => {
//   const result = guardPlanning({ nope: true } as any);

//   assert.equal(result.ok, false);
//   if (!result.ok) {
//     assert.equal(result.code, "INVALID_PLANNING_INPUT");
//     assert.equal(typeof result.message, "string");
//     assert.ok(result.trace);
//     assert.equal(result.trace.mode, "UNKNOWN");
//   }
// });

// test("guardPlanning does not append envelope errors or mutate env (pure parse guard)", () => {
//   const env = makeEnv();
//   const beforeErrorsLen = env.errors.length;
//   const beforePlanningHasRun = (env.stages.planning as any)?.hasRun;
//   const beforePlanningId = env.ids.planningId;

//   // Force failure by breaking the input in a way the schema should reject
//   env.ids.proposalId = "" as any;

//   const result = guardPlanning(env as any);

//   assert.equal(result.ok, false);

//   // 🔒 guard is pure: must not mutate env
//   assert.equal(env.errors.length, beforeErrorsLen);
//   assert.equal((env.stages.planning as any)?.hasRun, beforePlanningHasRun);
//   assert.equal(env.ids.planningId, beforePlanningId);
// });

// test("guardPlanning does not enforce prereqs via side-effects (missing snapshotId does not append errors)", () => {
//   const env = makeEnv();
//   const beforeErrorsLen = env.errors.length;

//   // Missing prereq for planning (per your pre-guard dependency table)
//   env.ids.snapshotId = undefined;

//   const result = guardPlanning(env as any);

//   // It may return ok:false depending on your PlanningInputSchema,
//   // but the key assertion is: it must not append errors to env.
//   assert.equal(env.errors.length, beforeErrorsLen);

//   // If it fails, it should be a parse/shape failure code, not prereq-gate behavior.
//   if (!result.ok) {
//     assert.equal(result.code, "INVALID_PLANNING_INPUT");
//     assert.ok(result.trace?.rulesApplied?.includes("PARSE_FAILED"));
//   }
// });

test("returns ok:true with parsed planning input when prereqs are satisfied + schema passes", () => {
  const env = makeEnv();

  // ensure prereq ids exist (schema may expect snapshotId, etc.)
  env.ids.snapshotId = env.ids.snapshotId ?? "snapshot_1";

  const result = guardPlanning(env as any);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.proposalId, env.ids.proposalId);
    assert.equal(result.data.snapshotId, env.ids.snapshotId);
    assert.ok(typeof result.data.validationDecision === "string");
    assert.ok(typeof result.data.planningId === "string");
    assert.ok(Array.isArray(result.data.plan));
  }
});

// test("returns ok:false INVALID_PLANNING_INPUT when schema parse fails (fail closed, no env mutation)", () => {
//   const env = makeEnv();
//   const beforeErrorsLen = env.errors.length;

//   (env.stages.validation as any) = {
//     ...(env.stages.validation as any),
//     hasRun: true,
//     validationId: env.ids.validationId ?? "validation_1",
//     decision: "APPROVE",
//   };

//   env.ids.snapshotId = env.ids.snapshotId ?? "snapshot_1";

//   // break something the schema should reject
//   (env.stages.planning as any) = {
//     ...(env.stages.planning as any),
//     hasRun: false,
//     plan: "not_an_array",
//   };

//   const result = guardPlanning(env as any);

//   assert.equal(result.ok, false);
//   if (!result.ok) {
//     assert.equal(result.code, "INVALID_PLANNING_INPUT");
//     assert.equal(result.trace.mode, "UNKNOWN");
//     assert.ok(result.trace.rulesApplied?.includes("PARSE_FAILED"));
//   }

//   // 🔒 guard is pure: must not append errors
//   assert.equal(env.errors.length, beforeErrorsLen);
// });

// ///////////// GuardPrePlanning
// function lastError(env: IngestionPipelineEnvelope) {
//   return env.errors[env.errors.length - 1];
// }

// test("appends HALT PLANNING_PREREQ_MISSING when required prior stage has not run (VALIDATION)", () => {
//   const env = makeEnv();

//   // Ensure dependency exists but has not run
//   (env.stages.validation as any) = {
//     ...(env.stages.validation as any),
//     hasRun: false,
//   };

//   const result = guardPrePlanning(env);

//   assert.equal(result.ok, false);
//   if (!result.ok) {
//     assert.ok(result.env.errors.length >= 1);
//     const err = lastError(result.env) as any;

//     assert.equal(err.stage, "PLANNING");
//     assert.equal(err.severity, "HALT");
//     assert.equal(err.code, "PLANNING_PREREQ_MISSING");
//   }
// });

// test("appends HALT PLANNING_PREREQ_MISSING when required ids are missing (validationId)", () => {
//   const env = makeEnv();

//   // planning deps require validationId per your PREV_STAGES_DEPS
//   env.ids.validationId = undefined;

//   const result = guardPrePlanning(env);

//   assert.equal(result.ok, false);
//   if (!result.ok) {
//     const err = lastError(result.env) as any;

//     assert.equal(err.stage, "PLANNING");
//     assert.equal(err.severity, "HALT");
//     assert.equal(err.code, "PLANNING_PREREQ_MISSING");

//     // trace should include idKey/value from assertIdExists
//     assert.equal(err.trace?.proposalId, env.ids.proposalId);
//     assert.equal(err.trace?.idKey, "validationId");
//     assert.equal(err.trace?.value, undefined);
//   }
// });

// test("appends HALT PLANNING_PREREQ_MISSING when required ids are missing (snapshotId)", () => {
//   const env = makeEnv();

//   env.ids.snapshotId = undefined;

//   const result = guardPrePlanning(env);

//   assert.equal(result.ok, false);
//   if (!result.ok) {
//     const err = lastError(result.env) as any;

//     assert.equal(err.stage, "PLANNING");
//     assert.equal(err.severity, "HALT");
//     assert.equal(err.code, "PLANNING_PREREQ_MISSING");

//     assert.equal(err.trace?.proposalId, env.ids.proposalId);
//     assert.equal(err.trace?.idKey, "snapshotId");
//     assert.equal(err.trace?.value, undefined);
//   }
// });

// test("returns ok:true when dependencies are satisfied (VALIDATION hasRun + ids present)", () => {
//   const env = makeEnv();

//   // Ensure VALIDATION is marked as run (dependency)
//   (env.stages.validation as any) = {
//     ...(env.stages.validation as any),
//     hasRun: true,
//   };

//   // Ensure IDs required by PLANNING deps exist (proposalId already exists)
//   env.ids.validationId = env.ids.validationId ?? "validation_1";
//   env.ids.snapshotId = env.ids.snapshotId ?? "snapshot_1";

//   const result = guardPrePlanning(env);

//   assert.equal(result.ok, true);
//   if (result.ok) {
//     assert.deepEqual(result.env, env);
//     assert.equal(result.env.errors.length, env.errors.length);
//   }
// });

// test("fail-closed: does not mark planning as run and does not create planningId on prereq failure", () => {
//   const env = makeEnv();

//   // Force prereq failure
//   (env.stages.validation as any) = {
//     ...(env.stages.validation as any),
//     hasRun: false,
//   };

//   const result = guardPrePlanning(env);

//   assert.equal(result.ok, false);
//   if (!result.ok) {
//     // prereq guard should only append an error; not mutate stage success flags
//     assert.equal(
//       (result.env.stages.planning as any)?.hasRun,
//       (env.stages.planning as any)?.hasRun
//     );
//     assert.equal(result.env.ids.planningId, env.ids.planningId);
//   }
// });
