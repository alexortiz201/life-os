import test from "node:test";
import assert from "node:assert/strict";

import { revalidationStage } from "#/rna/pipelines/ingestion/stages/revalidation/revalidation.stage";
import type { IngestionPipelineEnvelope } from "#types/rna/pipeline/ingestion/ingestion.types";
import { makeEnv } from "../../../../../utils";

function lastError(env: IngestionPipelineEnvelope) {
  return env.errors[env.errors.length - 1];
}

test("appends HALT error when execution stage has not run", () => {
  const env = makeEnv();
  env.stages.execution = { hasRun: false } as any;

  const out = revalidationStage(env);

  assert.equal(out.stages.revalidation.hasRun, false);
  assert.ok(out.errors.length >= 1);

  const err = lastError(out) as any;
  assert.equal(err.stage, "REVALIDATION");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "REVALIDATION_PREREQ_MISSING");
});

test("appends HALT error when validation stage has not run (commitPolicy missing)", () => {
  const env = makeEnv();
  env.stages.validation = { hasRun: false } as any;

  const out = revalidationStage(env);

  assert.equal(out.stages.revalidation.hasRun, false);
  assert.ok(out.errors.length >= 1);

  const err = lastError(out) as any;
  assert.equal(err.stage, "REVALIDATION");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "REVALIDATION_PREREQ_MISSING");
});

test("appends HALT error when snapshotId missing", () => {
  const env = makeEnv();
  env.ids.snapshotId = undefined;

  const out = revalidationStage(env);

  assert.equal(out.stages.revalidation.hasRun, false);
  assert.ok(out.errors.length >= 1);

  const err = lastError(out) as any;
  assert.equal(err.stage, "REVALIDATION");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "REVALIDATION_PREREQ_MISSING");
});

test("appends HALT error when effectsLogId missing", () => {
  const env = makeEnv();
  env.ids.effectsLogId = undefined;

  const out = revalidationStage(env);

  assert.equal(out.stages.revalidation.hasRun, false);
  assert.ok(out.errors.length >= 1);

  const err = lastError(out) as any;
  assert.equal(err.stage, "REVALIDATION");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "REVALIDATION_PREREQ_MISSING");
});

test("APPROVE_COMMIT when only ARTIFACT effects are present", () => {
  const env = makeEnv();

  (env.stages.validation as any) = {
    ...(env.stages.validation as any),
    hasRun: true,
    commitPolicy: { allowedModes: ["FULL"] as const },
  };

  (env.stages.execution as any).effectsLog = {
    effectsLogId: "effects_1",
    proposalId: "proposal_1",
    producedEffects: [
      {
        effectType: "ARTIFACT",
        objectId: "note_1",
        kind: "NOTE",
        trust: "PROVISIONAL",
      },
    ],
  };

  const out = revalidationStage(env);

  assert.equal(out.errors.length, 0);
  assert.equal(out.stages.revalidation.hasRun, true);

  const r = out.stages.revalidation as any;
  assert.equal(r.proposalId, "proposal_1");
  assert.equal(r.revalidation.outcome, "APPROVE_COMMIT");
  assert.deepEqual(r.revalidation.commitAllowList, []);
});

test("REJECT_COMMIT on drift (effectsLog.proposalId mismatch)", () => {
  const env = makeEnv();

  (env.stages.execution as any).effectsLog = {
    effectsLogId: "effects_1",
    proposalId: "proposal_X",
    producedEffects: [],
  };

  const out = revalidationStage(env);

  // drift is a valid output (not an error)
  assert.equal(out.errors.length, 0);
  assert.equal(out.stages.revalidation.hasRun, true);

  const r = out.stages.revalidation as any;
  assert.equal(r.revalidation.outcome, "REJECT_COMMIT");
  assert.ok(
    Array.isArray(r.revalidation.rulesApplied) &&
      r.revalidation.rulesApplied.includes("DRIFT_DETECTED")
  );
});

test("PARTIAL_NOT_ALLOWED when non-artifact effects exist and policy is FULL-only", () => {
  const env = makeEnv();

  // policy comes from the stage that produced it (validation)
  (env.stages.validation as any) = {
    ...(env.stages.validation as any),
    hasRun: true,
    commitPolicy: { allowedModes: ["FULL"] as const },
  };

  (env.stages.execution as any).effectsLog = {
    effectsLogId: "effects_1",
    proposalId: "proposal_1",
    producedEffects: [
      {
        effectType: "EVENT",
        eventName: "PIPELINE_TRIGGER",
        trust: "PROVISIONAL",
        payload: { foo: "bar" },
      },
      {
        effectType: "ARTIFACT",
        objectId: "note_1",
        kind: "NOTE",
        trust: "PROVISIONAL",
      },
    ],
  };

  const out = revalidationStage(env);

  assert.equal(out.stages.revalidation.hasRun, false);
  assert.ok(out.errors.length >= 1);

  const err = lastError(out) as any;
  assert.equal(err.stage, "REVALIDATION");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "PARTIAL_NOT_ALLOWED");
});

test("PARTIAL_COMMIT when non-artifact effects exist and policy allows PARTIAL", () => {
  const env = makeEnv();

  (env.stages.validation as any) = {
    ...(env.stages.validation as any),
    hasRun: true,
    commitPolicy: { allowedModes: ["FULL", "PARTIAL"] as const },
  };

  (env.stages.execution as any).effectsLog = {
    effectsLogId: "effects_1",
    proposalId: "proposal_1",
    producedEffects: [
      {
        effectType: "EVENT",
        eventName: "PIPELINE_TRIGGER",
        trust: "PROVISIONAL",
      },
      {
        effectType: "ARTIFACT",
        objectId: "note_1",
        kind: "NOTE",
        trust: "PROVISIONAL",
      },
      {
        effectType: "ARTIFACT",
        objectId: "note_2",
        kind: "NOTE",
        trust: "COMMITTED",
      },
    ],
  };

  const out = revalidationStage(env);

  assert.equal(out.errors.length, 0);
  assert.equal(out.stages.revalidation.hasRun, true);

  const r = out.stages.revalidation as any;
  assert.equal(r.revalidation.outcome, "PARTIAL_COMMIT");
  assert.deepEqual(r.revalidation.commitAllowList.sort(), ["note_1"]);
});
