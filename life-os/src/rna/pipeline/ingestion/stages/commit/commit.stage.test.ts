import test from "node:test";
import assert from "node:assert/strict";

import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";
import { PIPELINE_NAME } from "#/rna/pipeline/ingestion/ingestion.const";

import { commitStage } from "./commit.stage";

import {
  assertMatchId,
  makeEnv,
  resetStagesUpTo,
  unwrapRight,
  unwrapLeft,
  makeValidEffectsLog,
  lastError,
} from "#/shared/test-utils";

function getCommitRecord(env: IngestionPipelineEnvelope) {
  assert.equal(env.stages.commit.hasRun, true, "commit stage must have run");
  return env.stages.commit as any;
}

const makeCommitEnv = (patch?: any) =>
  resetStagesUpTo("commit", makeEnv(patch));

test("commits only PROVISIONAL produced artifacts", () => {
  const env = makeCommitEnv();

  (env.stages.revalidation as any).directive = {
    ...(env.stages.revalidation as any).directive,
    outcome: "APPROVE_COMMIT" as const,
    commitAllowList: ["note_1", "report_1"],
  };

  (env.stages.execution as any).effectsLog = makeValidEffectsLog({
    producedEffects: [
      {
        stableId: "producedEffect_1",
        effectType: "ARTIFACT",
        objectId: "note_1",
        kind: "NOTE",
        trust: "PROVISIONAL",
      },
      {
        stableId: "producedEffect_2",
        effectType: "ARTIFACT",
        objectId: "report_1",
        kind: "REPORT",
        trust: "PROVISIONAL",
      },
      {
        stableId: "producedEffect_3",
        effectType: "ARTIFACT",
        objectId: "note_2",
        kind: "NOTE",
        trust: "COMMITTED",
      },
      {
        stableId: "producedEffect_4",
        effectType: "ARTIFACT",
        objectId: "raw_1",
        kind: "RAW",
        trust: "UNTRUSTED",
      },
    ],
  });

  const out = commitStage(env);
  const nextEnv = unwrapRight(out);

  assert.equal(nextEnv.errors.length, 0);

  const c = getCommitRecord(nextEnv);
  assertMatchId(c.proposalId, "proposal_");
  assertMatchId(c.commitId, "commit_");

  assert.equal(c.effects.approved.length, 2);
  assert.deepEqual(c.effects.approved.map((o: any) => o.objectId).sort(), [
    "note_1",
    "report_1",
  ]);

  for (const obj of c.effects.approved) {
    assert.equal(obj.trust, "COMMITTED");
    assert.equal(typeof obj.stableId, "string");
    assert.ok(obj.stableId.length > 0);
  }
});

test("commits nothing if there are no PROVISIONAL artifacts", () => {
  const env = makeCommitEnv();

  (env.stages.revalidation as any).directive = {
    ...(env.stages.revalidation as any).directive,
    outcome: "APPROVE_COMMIT" as const,
    commitAllowList: [],
  };

  (env.stages.execution as any).effectsLog = makeValidEffectsLog({
    producedEffects: [
      {
        stableId: "producedEffect_1",
        effectType: "ARTIFACT",
        objectId: "note_2",
        kind: "NOTE",
        trust: "COMMITTED",
      },
      {
        stableId: "producedEffect_2",
        effectType: "ARTIFACT",
        objectId: "raw_1",
        kind: "RAW",
        trust: "UNTRUSTED",
      },
    ],
  });

  const out = commitStage(env);
  const nextEnv = unwrapRight(out);

  assert.equal(nextEnv.errors.length, 0);

  const c = getCommitRecord(nextEnv);
  assert.equal(c.effects.approved.length, 0);
  assert.equal(c.promotions.length, 0);

  // outbox should also be empty
  assert.ok(Array.isArray(c.outbox));
  assert.equal(c.outbox.length, 0);
});

test("fails closed when revalidation.proposalId mismatches envelope proposalId", () => {
  const env = makeCommitEnv({
    ids: { proposalId: "proposal_1" },
  });

  (env.stages.revalidation as any).proposalId = "proposal_X";
  (env.stages.revalidation as any).directive = {
    ...(env.stages.revalidation as any).directive,
    proposalId: "proposal_X",
    outcome: "APPROVE_COMMIT" as const,
    commitAllowList: [],
  };

  const out = commitStage(env);
  const left = unwrapLeft(out);

  assert.ok(left.env.errors.length >= 1);

  const err = lastError(left.env) as any;
  assert.equal(err.stage, "COMMIT");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "COMMIT_INPUT_MISMATCH");

  assert.equal(left.env.stages.commit.hasRun, false);
});

test("fails closed on unsupported outcome (REJECT_COMMIT)", () => {
  const env = makeCommitEnv();

  (env.stages.revalidation as any).directive = {
    ...(env.stages.revalidation as any).directive,
    outcome: "REJECT_COMMIT" as const,
    commitAllowList: [],
  };

  const out = commitStage(env);
  const left = unwrapLeft(out);

  const err = lastError(left.env) as any;
  assert.equal(err.stage, "COMMIT");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "COMMIT_OUTCOME_UNSUPPORTED");

  assert.equal(left.env.stages.commit.hasRun, false);
});

test("PARTIAL_COMMIT with empty allowlist commits nothing (but emits commit record)", () => {
  const env = makeCommitEnv();

  (env.stages.revalidation as any).directive = {
    ...(env.stages.revalidation as any).directive,
    outcome: "PARTIAL_COMMIT" as const,
    commitAllowList: [],
  };

  (env.stages.execution as any).effectsLog = makeValidEffectsLog({
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

  const out = commitStage(env);
  const nextEnv = unwrapRight(out);

  assert.equal(nextEnv.errors.length, 0);

  const c = getCommitRecord(nextEnv);
  assert.equal(c.effects.approved.length, 0);
  assert.equal(c.promotions.length, 0);

  // outbox should be empty because nothing approved
  assert.ok(Array.isArray(c.outbox));
  assert.equal(c.outbox.length, 0);
});

test("PARTIAL_COMMIT commits only allowlisted PROVISIONAL artifacts", () => {
  const env = makeCommitEnv();

  (env.stages.revalidation as any).directive = {
    ...(env.stages.revalidation as any).directive,
    outcome: "PARTIAL_COMMIT" as const,
    commitAllowList: ["note_1"],
  };

  (env.stages.execution as any).effectsLog = makeValidEffectsLog({
    producedEffects: [
      {
        stableId: "producedEffect_1",
        effectType: "ARTIFACT",
        objectId: "note_1",
        kind: "NOTE",
        trust: "PROVISIONAL",
      },
      {
        stableId: "producedEffect_2",
        effectType: "ARTIFACT",
        objectId: "report_1",
        kind: "REPORT",
        trust: "PROVISIONAL",
      },
    ],
  });

  const out = commitStage(env);
  const nextEnv = unwrapRight(out);

  assert.equal(nextEnv.errors.length, 0);

  const c = getCommitRecord(nextEnv);
  assert.equal(c.effects.approved.length, 1);
  assert.equal(c.effects.approved[0].objectId, "note_1");
  assert.equal(c.promotions.length, 1);
  assert.equal(c.promotions[0].objectId, "note_1");
});

test("PARTIAL_COMMIT fails when allowlist references unknown objects", () => {
  const env = makeCommitEnv();

  (env.stages.revalidation as any).directive = {
    ...(env.stages.revalidation as any).directive,
    outcome: "PARTIAL_COMMIT" as const,
    commitAllowList: ["ghost_id"],
  };

  (env.stages.execution as any).effectsLog = makeValidEffectsLog({
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

  const out = commitStage(env);
  const left = unwrapLeft(out);

  assert.equal(left.env.stages.commit.hasRun, false);

  const err = lastError(left.env) as any;
  assert.equal(err.stage, "COMMIT");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "ALLOWLIST_UNKNOWN_OBJECT");
});

test("does not emit promotions for non-PROVISIONAL artifacts (records rejectedEffects)", () => {
  const env = makeCommitEnv();

  (env.stages.revalidation as any).directive = {
    ...(env.stages.revalidation as any).directive,
    outcome: "APPROVE_COMMIT" as const,
    commitAllowList: ["note_2", "raw_1"],
  };

  (env.stages.execution as any).effectsLog = makeValidEffectsLog({
    producedEffects: [
      {
        stableId: "producedEffect_1",
        effectType: "ARTIFACT",
        objectId: "note_2",
        kind: "NOTE",
        trust: "COMMITTED",
      },
      {
        stableId: "producedEffect_2",
        effectType: "ARTIFACT",
        objectId: "raw_1",
        kind: "RAW",
        trust: "UNTRUSTED",
      },
    ],
  });

  const out = commitStage(env);
  const nextEnv = unwrapRight(out);

  assert.equal(nextEnv.errors.length, 0);

  const c = getCommitRecord(nextEnv);
  assert.equal(c.effects.approved.length, 0);
  assert.equal(c.promotions.length, 0);

  // coverage: rejectedEffects should be recorded
  assert.ok(Array.isArray(c.effects.rejected));
  assert.deepEqual(c.effects.rejected.map((e: any) => e.objectId).sort(), [
    "note_2",
    "raw_1",
  ]);
});

/////////////////////////
// Outbox-specific tests
/////////////////////////

test("outbox: emits one entry per approved effect and includes required metadata", () => {
  const env = makeCommitEnv();

  (env.stages.revalidation as any).directive = {
    ...(env.stages.revalidation as any).directive,
    outcome: "APPROVE_COMMIT" as const,
    commitAllowList: ["note_1", "report_1"],
  };

  (env.stages.execution as any).effectsLog = makeValidEffectsLog({
    producedEffects: [
      {
        stableId: "producedEffect_1",
        effectType: "ARTIFACT",
        objectId: "note_1",
        kind: "NOTE",
        trust: "PROVISIONAL",
      },
      {
        stableId: "producedEffect_2",
        effectType: "ARTIFACT",
        objectId: "report_1",
        kind: "REPORT",
        trust: "PROVISIONAL",
      },
    ],
  });

  const out = commitStage(env);
  const nextEnv = unwrapRight(out);

  const c = getCommitRecord(nextEnv);

  assert.ok(Array.isArray(c.outbox));
  assert.equal(c.outbox.length, c.effects.approved.length);
  assert.equal(c.outbox.length, 2);

  // Entry-level invariants
  for (const entry of c.outbox) {
    assertMatchId(entry.outboxId, "outbox_");
    assert.equal(entry.pipeline, PIPELINE_NAME);
    assert.equal(entry.stage, "COMMIT");
    assert.equal(typeof entry.idempotencyKey, "string");
    assert.ok(entry.idempotencyKey.length > 0);

    // status expectation: align with your current commit implementation
    assert.equal(entry.status, "PENDING");

    assert.equal(typeof entry.createdAt, "number");
    assert.equal(typeof entry.updatedAt, "number");
    assert.equal(entry.attempts, 0);

    // effect should be the approved effect payload
    assert.ok(entry.effect);
    assert.equal(entry.effect.trust, "COMMITTED");
    assert.equal(typeof entry.effect.stableId, "string");
  }

  // Ensure the outbox effects correspond to approved objectIds
  const approvedIds = c.effects.approved.map((e: any) => e.objectId).sort();
  const outboxIds = c.outbox.map((e: any) => e.effect.objectId).sort();
  assert.deepEqual(outboxIds, approvedIds);
});

test("outbox: no approved effects => outbox is empty", () => {
  const env = makeCommitEnv();

  (env.stages.revalidation as any).directive = {
    ...(env.stages.revalidation as any).directive,
    outcome: "APPROVE_COMMIT" as const,
    commitAllowList: [],
  };

  (env.stages.execution as any).effectsLog = makeValidEffectsLog({
    producedEffects: [
      {
        stableId: "producedEffect_1",
        effectType: "ARTIFACT",
        objectId: "note_2",
        kind: "NOTE",
        trust: "COMMITTED",
      },
    ],
  });

  const out = commitStage(env);
  const nextEnv = unwrapRight(out);

  const c = getCommitRecord(nextEnv);
  assert.ok(Array.isArray(c.outbox));
  assert.equal(c.outbox.length, 0);
});

test("outbox: on HALT/Left, commit stage must not emit outbox", () => {
  const env = makeCommitEnv();

  // force failure: missing required revalidation stage output
  (env.stages.revalidation as any).hasRun = false;

  const out = commitStage(env);
  const left = unwrapLeft(out);

  assert.equal(left.env.stages.commit.hasRun, false);

  // outbox field should not exist on a not-run commit stage
  const c = left.env.stages.commit as any;
  assert.equal(c.outbox, undefined);
});
