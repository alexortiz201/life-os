import test from "node:test";
import assert from "node:assert/strict";

import { pipe } from "fp-ts/function";
import * as E from "fp-ts/Either";

import type { IntakeEnvelope } from "#/rna/pipeline/ingestion/stages/intake/intake.types";

// stages
import { intakeStage } from "#/rna/pipeline/ingestion/stages/intake/intake.stage";
import { validationStage } from "#/rna/pipeline/ingestion/stages/validation/validation.stage";
import { planningStage } from "#/rna/pipeline/ingestion/stages/planning/planning.stage";
import { executionStage } from "#/rna/pipeline/ingestion/stages/execution/execution.stage";
import { revalidationStage } from "#/rna/pipeline/ingestion/stages/revalidation/revalidation.stage";
import { commitStage } from "#/rna/pipeline/ingestion/stages/commit/commit.stage";

// shared test utils
import {
  makeEnv as makeEnvUtil,
  resetStagesUpTo,
  unwrapRight,
  unwrapLeft,
} from "#/shared/test-utils";

/**
 * Build a “valid enough” env that can traverse the entire spine.
 * Adjust any specifics to match your schemas (kinds / allow list / etc).
 */
function makeE2eEnv(): IntakeEnvelope {
  const env = makeEnvUtil({
    stages: {
      intake: { hasRun: false },
      validation: { hasRun: false },
      planning: { hasRun: false },
      execution: { hasRun: false },
      revalidation: { hasRun: false },
      commit: { hasRun: false },
    },
  });

  // If you’re using this helper elsewhere, keep it consistent.
  const base = resetStagesUpTo("intake", env);

  // Make sure snapshot/ids prereqs exist (your makeEnv likely already does this)
  base.ids.snapshotId = base.ids.snapshotId ?? "snapshot_1";

  return {
    ...(base as any),
    snapshot: {
      ...(base as any).snapshot,
      permissions: {
        actor: { actorId: "user_1", actorType: "USER" },
        allow: ["WEEKLY_REFLECTION"] as const,
      },
    },
    rawProposal: {
      intent: "weekly reflection",
      actor: { actorId: "user_1", actorType: "USER" },
      target: { entity: "self", scope: { allowedKinds: ["NOTE"] as const } },
      dependencies: [],
      impact: "LOW",
      reversibilityClaim: "REVERSIBLE",
    },
  } as IntakeEnvelope;
}

test("E2E: ingestion spine runs end-to-end and produces a commit record", () => {
  const out = pipe(
    E.right(makeE2eEnv()),
    E.chainW(intakeStage),
    E.chainW(validationStage),
    E.chainW(planningStage),
    E.chainW(executionStage),
    E.chainW(revalidationStage),
    E.chainW(commitStage)
  );

  const finalEnv = unwrapRight(out);

  // stage progression
  assert.equal(finalEnv.stages.intake.hasRun, true);
  assert.equal(finalEnv.stages.validation.hasRun, true);
  assert.equal(finalEnv.stages.planning.hasRun, true);
  assert.equal(finalEnv.stages.execution.hasRun, true);
  assert.equal(finalEnv.stages.revalidation.hasRun, true);
  assert.equal(finalEnv.stages.commit.hasRun, true);

  // ids should exist by the end
  assert.ok(finalEnv.ids.proposalId);
  assert.ok(finalEnv.ids.intakeId);
  assert.ok(finalEnv.ids.validationId);
  assert.ok(finalEnv.ids.planningId);
  assert.ok(finalEnv.ids.executionId);
  assert.ok(finalEnv.ids.effectsLogId);
  assert.ok(finalEnv.ids.revalidationId);
  assert.ok(finalEnv.ids.commitId);

  // commit record shape (high-level invariant)
  const c = finalEnv.stages.commit as any;
  assert.equal(c.commitId, finalEnv.ids.commitId);
  assert.equal(c.proposalId, finalEnv.ids.proposalId);

  assert.ok(c.effects);
  assert.ok(Array.isArray(c.effects.approved));
  assert.ok(Array.isArray(c.effects.rejected));
  assert.ok(Array.isArray(c.effects.ignored));

  // “trust boundary” baseline: commit promotes to COMMITTED (if anything is approved)
  for (const obj of c.effects.approved) {
    assert.equal(obj.trust, "COMMITTED");
  }
});

test("E2E: validation halts when snapshot permissions allowlist is empty", () => {
  const env = makeE2eEnv();

  // violate validation invariant
  (env as any).snapshot = {
    ...(env as any).snapshot,
    permissions: {
      actor: { actorId: "user_1", actorType: "USER" },
      allow: [] as const,
    },
  };

  const out = pipe(
    E.right(env),
    E.chainW(intakeStage),
    E.chainW(validationStage) // should Left here
  );

  const left = unwrapLeft(out);

  // the “stage left” wrapper pattern you’re using:
  assert.ok(left.env.errors.length >= 1);
  const err = left.env.errors[left.env.errors.length - 1] as any;

  assert.equal(err.stage, "VALIDATION");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "SNAPSHOT_PERMISSION_NOT_ALLOWED");

  // should not advance
  assert.equal(left.env.stages.planning.hasRun, false);
  assert.equal(left.env.stages.execution.hasRun, false);
});
