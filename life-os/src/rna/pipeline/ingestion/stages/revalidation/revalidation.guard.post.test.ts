import test from "node:test";
import assert from "node:assert/strict";

import { fingerprint } from "#/domain/encoding/fingerprint";

import {
  guardRevalidation,
  postGuardRevalidation,
} from "#/rna/pipeline/ingestion/stages/revalidation/revalidation.guard";
import { makeEnv as makeEnvUtil, resetStagesUpTo } from "#/shared/test-utils";

const makeEnv = () => resetStagesUpTo("revalidation", makeEnvUtil());

function makeValidEffectsLog(params?: {
  proposalId?: string;
  producedEffects?: any[];
  effectsLogId?: string;
  fingerprint?: string;
}) {
  const effectsLogId = params?.effectsLogId ?? "effects_1";
  const proposalId = params?.proposalId ?? "proposal_1";
  const producedEffects = params?.producedEffects ?? [];

  const fp =
    params?.fingerprint ??
    fingerprint({
      proposalId,
      effectsLogId,
      producedEffects,
    });

  return {
    effectsLogId,
    proposalId,
    producedEffects,
    fingerprint: fp,
  };
}

//////////////////// Post Guard
test("postGuardRevalidation returns REJECT_COMMIT on drift (effectsLog.proposalId mismatch)", () => {
  const env = makeEnv();

  // drift (proposalId mismatch)
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

test("postGuardRevalidation returns REJECT_COMMIT on drift (fingerprint mismatch)", () => {
  const env = makeEnv();

  const proposalId = env.ids.proposalId;

  // Start with a base effectsLog, then compute a fingerprint for the ORIGINAL,
  // and drift producedEffects WITHOUT updating fingerprint.
  const originalProducedEffects = [
    {
      stableId: "producedEffect_1",
      effectType: "ARTIFACT",
      objectId: "note_1",
      kind: "NOTE",
      trust: "PROVISIONAL",
    },
  ];

  const effectsLogId = "effects_1";
  const originalFp = fingerprint({
    proposalId,
    effectsLogId,
    producedEffects: originalProducedEffects,
  });

  (env.stages.execution as any).effectsLog = {
    effectsLogId,
    proposalId,
    fingerprint: originalFp, // fingerprint matches originalProducedEffects...
    producedEffects: [
      ...originalProducedEffects,
      // ...but now we drift the producedEffects
      {
        stableId: "producedEffect_2",
        effectType: "ARTIFACT",
        objectId: "drift_note",
        kind: "NOTE",
        trust: "PROVISIONAL",
      },
    ],
  };

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
        stableId: "producedEffect_1",
        effectType: "EVENT",
        eventName: "TRIGGER_PIPELINE",
        trust: "PROVISIONAL",
      },
      {
        stableId: "producedEffect_2",
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
        stableId: "producedEffect_1",
        effectType: "EVENT",
        eventName: "TRIGGER_PIPELINE",
        trust: "PROVISIONAL",
      },
      {
        stableId: "producedEffect_2",
        effectType: "ARTIFACT",
        objectId: "note_1",
        kind: "NOTE",
        trust: "PROVISIONAL",
      },
      {
        stableId: "producedEffect_3",
        effectType: "ARTIFACT",
        objectId: "note_2",
        kind: "NOTE",
        trust: "COMMITTED",
      },
      // duplicates should be deduped
      {
        stableId: "producedEffect_2", // stableId should be derived of content and deterministic
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
        stableId: "producedEffect_1",
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

test("fingerprint correct does not cause false drift (still produces expected directive)", () => {
  const env = makeEnv();

  // This is basically a focused "no false positives" check:
  // proposalId matches + fingerprint matches + non-artifact effects => PARTIAL_COMMIT when allowed
  (env.stages.validation as any).commitPolicy = {
    allowedModes: ["FULL", "PARTIAL"] as const,
  };

  const producedEffects = [
    {
      stableId: "producedEffect_1",
      effectType: "EVENT",
      eventName: "TRIGGER_PIPELINE",
      trust: "PROVISIONAL",
    },
    {
      stableId: "producedEffect_2",
      effectType: "ARTIFACT",
      objectId: "note_1",
      kind: "NOTE",
      trust: "PROVISIONAL",
    },
  ];

  (env.stages.execution as any).effectsLog = makeValidEffectsLog({
    proposalId: env.ids.proposalId,
    producedEffects,
  });

  const parsed = guardRevalidation(env as any);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const result = postGuardRevalidation({ data: parsed.data } as any);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.directive.outcome, "PARTIAL_COMMIT");
    assert.deepEqual(result.data.directive.commitAllowList, ["note_1"]);
    // importantly: no drift rule applied
    assert.equal(
      result.data.directive.rulesApplied.includes("DRIFT_DETECTED"),
      false,
    );
  }
});
