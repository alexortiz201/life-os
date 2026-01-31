import test from "node:test";
import assert from "node:assert/strict";

import {
  guardRevalidation,
  guardPreRevalidation,
  postGuardRevalidation,
} from "#/rna/pipeline/ingestion/stages/revalidation/revalidation.guard";
import {
  makeEnv as makeEnvUtil,
  resetStagesUpTo,
  lastError,
} from "#/shared/test-utils";

const makeEnv = () => resetStagesUpTo("revalidation", makeEnvUtil());

function makeValidEffectsLog(params?: {
  proposalId?: string;
  producedEffects?: any[];
}) {
  return {
    effectsLogId: "effects_1",
    proposalId: params?.proposalId ?? "proposal_1",
    producedEffects: params?.producedEffects ?? [],
  };
}

//////////////////// PreGuard
test("guardPreRevalidation: HALT when execution stage has not run", () => {
  const env = makeEnv();

  // prereq violated
  (env.stages.execution as any) = {
    ...(env.stages.execution as any),
    hasRun: false,
  };

  const res = guardPreRevalidation(env);

  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.ok(res.env.errors.length >= 1);

    const err = lastError(res.env) as any;
    assert.equal(err.stage, "REVALIDATION");
    assert.equal(err.severity, "HALT");
    assert.equal(err.code, "REVALIDATION_PREREQ_MISSING");

    // trace contract: should explain what failed (shape may vary)
    assert.ok(err.trace);
    assert.equal(err.trace.proposalId, env.ids.proposalId);
    // old implementation used executionHasRun; preGuardFactory may use a different key
    // so check broadly:
    assert.ok(
      "executionHasRun" in err.trace ||
        "stageKey" in err.trace ||
        "dependsOn" in err.trace,
    );
  }
});

test("guardPreRevalidation: HALT when validation stage has not run", () => {
  const env = makeEnv();

  // prereq violated
  (env.stages.validation as any) = {
    ...(env.stages.validation as any),
    hasRun: false,
  };

  const res = guardPreRevalidation(env);

  assert.equal(res.ok, false);
  if (!res.ok) {
    const err = lastError(res.env) as any;

    assert.equal(err.stage, "REVALIDATION");
    assert.equal(err.severity, "HALT");
    assert.equal(err.code, "REVALIDATION_PREREQ_MISSING");

    assert.ok(err.trace);
    assert.equal(err.trace.proposalId, env.ids.proposalId);
    assert.ok(
      "validationHasRun" in err.trace ||
        "stageKey" in err.trace ||
        "dependsOn" in err.trace,
    );
  }
});

test("guardPreRevalidation: HALT when snapshotId missing", () => {
  const env = makeEnv();

  // prereq violated
  env.ids.snapshotId = undefined;

  const res = guardPreRevalidation(env);

  assert.equal(res.ok, false);
  if (!res.ok) {
    const err = lastError(res.env) as any;

    assert.equal(err.stage, "REVALIDATION");
    assert.equal(err.severity, "HALT");
    assert.equal(err.code, "REVALIDATION_PREREQ_MISSING");

    assert.ok(err.trace);
    assert.equal(err.trace.proposalId, env.ids.proposalId);

    // many of your preguards use { idKey, value } pattern
    if ("idKey" in err.trace) {
      assert.equal(err.trace.idKey, "snapshotId");
    }
  }
});

test("guardPreRevalidation: HALT when effectsLogId missing", () => {
  const env = makeEnv();

  // prereq violated
  env.ids.effectsLogId = undefined;

  const res = guardPreRevalidation(env);

  assert.equal(res.ok, false);
  if (!res.ok) {
    const err = lastError(res.env) as any;

    assert.equal(err.stage, "REVALIDATION");
    assert.equal(err.severity, "HALT");
    assert.equal(err.code, "REVALIDATION_PREREQ_MISSING");

    assert.ok(err.trace);
    assert.equal(err.trace.proposalId, env.ids.proposalId);

    if ("idKey" in err.trace) {
      assert.equal(err.trace.idKey, "effectsLogId");
    }
  }
});

test("guardPreRevalidation: ok:true when prereqs satisfied", () => {
  const env = makeEnv();
  const res = guardPreRevalidation(env);

  assert.equal(res.ok, true);
  if (res.ok) {
    // should be identity on env
    assert.equal(res.env, env);
  }
});

test("guardPreRevalidation: fail-closed does not mark revalidation as run or create revalidationId", () => {
  const env = makeEnv();

  // force a prereq failure
  (env.stages.execution as any) = {
    ...(env.stages.execution as any),
    hasRun: false,
  };

  const beforeHasRun = (env.stages.revalidation as any)?.hasRun;
  const beforeRevalidationId = env.ids.revalidationId;

  const res = guardPreRevalidation(env);

  assert.equal(res.ok, false);
  if (!res.ok) {
    // prereq guard should only append an error; it should not write success outputs
    assert.equal((res.env.stages.revalidation as any)?.hasRun, beforeHasRun);
    assert.equal(res.env.ids.revalidationId, beforeRevalidationId);
  }
});

//////////////////// Guard
test("guardRevalidation returns ok:false INVALID_REVALIDATION_INPUT when input shape is wrong", () => {
  const result = guardRevalidation({ nope: true } as any);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "INVALID_REVALIDATION_INPUT");
    assert.equal(typeof result.message, "string");
    assert.ok(result.trace);
    assert.equal(result.trace.mode, "UNKNOWN");
  }
});

test("guardRevalidation returns ok:false when required plucked fields are missing (parse fails)", () => {
  const env = makeEnv();

  // break a required field for schema parsing
  env.ids.snapshotId = undefined;

  const result = guardRevalidation(env as any);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "INVALID_REVALIDATION_INPUT");
    assert.ok(result.trace?.rulesApplied?.includes("PARSE_FAILED"));
  }
});

test("guardRevalidation returns ok:true and plucks + parses the expected fields", () => {
  const env = makeEnv();
  const result = guardRevalidation(env as any);

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.data.proposalId, env.ids.proposalId);
    assert.equal(result.data.snapshotId, env.ids.snapshotId);
    assert.equal(result.data.executionId, env.ids.executionId);
    assert.equal(result.data.planningId, env.ids.planningId);

    // from stages.validation.validationId
    assert.equal(result.data.validationDecision, "validation_1");

    // plan should be the modeled plan (not string[])
    assert.deepEqual(result.data.plan, (env.stages.planning as any).plan);

    // commitPolicy must be present + typed
    assert.deepEqual(result.data.commitPolicy, {
      allowedModes: ["FULL"],
    });

    // effectsLog should be an object
    assert.deepEqual(
      result.data.effectsLog,
      (env.stages.execution as any).effectsLog,
    );
  }
});

test("postGuardRevalidation returns REJECT_COMMIT on drift (effectsLog.proposalId mismatch)", () => {
  const env = makeEnv();

  // drift
  (env.stages.execution as any).effectsLog = makeValidEffectsLog({
    proposalId: "proposal_X",
    producedEffects: [],
  });

  const parsed = guardRevalidation(env as any);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const result = postGuardRevalidation({ data: parsed.data } as any);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.directive.outcome, "REJECT_COMMIT");
    assert.ok(result.data.directive.rulesApplied.includes("DRIFT_DETECTED"));
  }
});

test("FULL-only policy fails closed if PARTIAL would be required (non-artifact effects present)", () => {
  const env = makeEnv();

  // FULL-only
  (env.stages.validation as any).commitPolicy = {
    allowedModes: ["FULL"] as const,
  };

  // non-artifact effect present
  (env.stages.execution as any).effectsLog = makeValidEffectsLog({
    proposalId: "proposal_1",
    producedEffects: [
      {
        effectType: "EVENT",
        eventName: "TRIGGER_PIPELINE",
        trust: "PROVISIONAL",
      },
      {
        effectType: "ARTIFACT",
        objectId: "note_1",
        kind: "NOTE",
        trust: "PROVISIONAL",
      },
    ],
  });

  const parsed = guardRevalidation(env as any);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const result = postGuardRevalidation({ data: parsed.data } as any);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "PARTIAL_NOT_ALLOWED");
    assert.ok(
      result.trace?.rulesApplied?.includes("NON_ARTIFACT_EFFECTS_PRESENT"),
    );
    assert.ok(
      result.trace?.rulesApplied?.includes("PARTIAL_NOT_ALLOWED_BY_POLICY"),
    );
  }
});

test("PARTIAL allowed produces PARTIAL_COMMIT and allowlist of provisional ARTIFACT ids", () => {
  const env = makeEnv();

  (env.stages.validation as any).commitPolicy = {
    allowedModes: ["FULL", "PARTIAL"] as const,
  };

  (env.stages.execution as any).effectsLog = makeValidEffectsLog({
    proposalId: "proposal_1",
    producedEffects: [
      {
        effectType: "EVENT",
        eventName: "TRIGGER_PIPELINE",
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
      // duplicates should be deduped
      {
        effectType: "ARTIFACT",
        objectId: "note_1",
        kind: "NOTE",
        trust: "PROVISIONAL",
      },
    ],
  });

  const parsed = guardRevalidation(env as any);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const result = postGuardRevalidation({ data: parsed.data } as any);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.directive.outcome, "PARTIAL_COMMIT");
    assert.deepEqual(result.data.directive.commitAllowList, ["note_1"]);
    assert.ok(
      result.data.directive.rulesApplied.includes(
        "NON_ARTIFACT_EFFECTS_PRESENT",
      ),
    );
  }
});

test("no drift + no non-artifact effects => APPROVE_COMMIT", () => {
  const env = makeEnv();

  (env.stages.execution as any).effectsLog = makeValidEffectsLog({
    proposalId: "proposal_1",
    producedEffects: [
      {
        effectType: "ARTIFACT",
        objectId: "note_1",
        kind: "NOTE",
        trust: "PROVISIONAL",
      },
    ],
  });

  const parsed = guardRevalidation(env as any);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const result = postGuardRevalidation({ data: parsed.data } as any);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.directive.outcome, "APPROVE_COMMIT");
    assert.deepEqual(result.data.directive.commitAllowList, []);
  }
});
