import test from "node:test";
import assert from "node:assert/strict";

import { intakeStage } from "#/rna/pipeline/ingestion/stages/intake/intake.stage";
import {
  resetStagesUpTo,
  unwrapLeft,
  unwrapRight,
  lastError,
  makeEnv as makeEnvUtil,
} from "#/shared/test-utils";

const makeEnv = () => {
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

  return resetStagesUpTo("intake", env);
};

test("appends HALT error when rawProposal missing (structural invalidity)", () => {
  const env = makeEnv();

  // present but structurally invalid
  (env as any).rawProposal = {};

  const out = intakeStage(env as any);
  const left = unwrapLeft(out);

  assert.equal(left.env.stages.intake.hasRun, false);
  assert.ok(left.env.errors.length >= 1);

  const err = lastError(left.env) as any;
  assert.equal(err.stage, "INTAKE");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "INVALID_INTAKE_INPUT");
});

test("does not reject on 'weird' meaning if structurally valid (intake never judges meaning)", () => {
  const env = makeEnv();

  (env as any).rawProposal = {
    intent: "do something questionable",
    actor: { actorId: "user_1", actorType: "USER" },
    target: {
      entity: "UNKNOWN_ENTITY",
      scope: { allowedKinds: ["NOTE"] as const },
    },
    dependencies: [],
    impact: "HIGH",
    reversibilityClaim: "REVERSIBLE",
  };

  const out = intakeStage(env as any);
  const nextEnv = unwrapRight(out);

  assert.equal(nextEnv.errors.length, 0);
  assert.equal(nextEnv.stages.intake.hasRun, true);

  const s = nextEnv.stages.intake as any;
  assert.equal(typeof s.ranAt, "number");
  assert.equal(typeof s.observed.proposalId, "string");
  assert.equal(s.observed.proposalId, nextEnv.ids.proposalId);
});

test("writes PROPOSAL_RECORD with id + fingerprint + preserved raw payload", () => {
  const env = makeEnv();

  const rawProposal = {
    intent: "weekly reflection",
    actor: { actorId: "user_1", actorType: "USER" },
    target: {
      entity: "self",
      scope: { allowedKinds: ["NOTE"] as const },
    },
    dependencies: [],
    impact: "LOW",
    reversibilityClaim: "REVERSIBLE",
  };

  (env as any).rawProposal = rawProposal;

  const out = intakeStage(env as any);
  const nextEnv = unwrapRight(out);

  assert.equal(nextEnv.errors.length, 0);
  assert.equal(nextEnv.stages.intake.hasRun, true);

  // stage should create intakeId
  assert.equal(typeof nextEnv.ids.intakeId, "string");
  assert.ok(nextEnv.ids.intakeId, "intakeId should be set after intake stage");
  assert.ok(nextEnv.ids.intakeId.length > 0);

  const intake = nextEnv.stages.intake as any;

  assert.equal(intake.observed.proposalId, nextEnv.ids.proposalId);
  assert.equal(intake.proposal.id, nextEnv.ids.proposalId);
  assert.equal(intake.proposal.proposalId, nextEnv.ids.proposalId);

  assert.deepEqual(intake.proposal.rawProposal, rawProposal);

  assert.equal(typeof intake.proposal.fingerprint, "string");
  assert.ok(intake.proposal.fingerprint.length > 0);

  assert.equal(typeof intake.ranAt, "number");
  assert.equal(typeof intake.proposal.intakeTimestamp, "string");
  assert.equal(typeof intake.proposal.createdAt, "string");
});

test("determinism: same proposalId + identical rawProposal => identical fingerprints", () => {
  const env1 = makeEnv();
  const env2 = makeEnv();

  env1.ids.proposalId = "proposal_FIXED";
  env2.ids.proposalId = "proposal_FIXED";

  const raw = {
    intent: "weekly reflection",
    actor: { actorId: "user_1", actorType: "USER" },
    target: {
      entity: "self",
      scope: { allowedKinds: ["NOTE"] as const },
    },
    dependencies: [],
    impact: "LOW",
    reversibilityClaim: "REVERSIBLE",
  };

  (env1 as any).rawProposal = raw;
  (env2 as any).rawProposal = {
    ...raw,
    actor: { ...raw.actor },
    target: { ...raw.target, scope: { ...raw.target.scope } },
  };

  const out1 = intakeStage(env1 as any);
  const out2 = intakeStage(env2 as any);

  const next1 = unwrapRight(out1);
  const next2 = unwrapRight(out2);

  assert.equal(next1.errors.length, 0);
  assert.equal(next2.errors.length, 0);

  const fp1 = (next1.stages.intake as any).proposal?.fingerprint;
  const fp2 = (next2.stages.intake as any).proposal?.fingerprint;

  assert.equal(typeof fp1, "string");
  assert.equal(typeof fp2, "string");
  assert.equal(fp1, fp2);
});

test("immutability: if intake already hasRun, appends HALT and does not overwrite existing record", () => {
  const env = makeEnv();

  (env.stages.intake as any) = {
    ...(env.stages.intake as any),
    hasRun: true,
    ranAt: 111,
    intakeId: "intake_old",
    observed: { proposalId: "proposal_old" },
    proposal: { fingerprint: "fp_1", rawProposal: { a: 1 } },
  };

  (env as any).rawProposal = {
    intent: "DIFFERENT",
    actor: { actorId: "user_1", actorType: "USER" },
    target: { entity: "self", scope: { allowedKinds: ["NOTE"] as const } },
    dependencies: [],
    impact: "LOW",
    reversibilityClaim: "REVERSIBLE",
  };

  const out = intakeStage(env as any);
  const left = unwrapLeft(out);

  assert.ok(left.env.errors.length >= 1);

  const err = lastError(left.env) as any;
  assert.equal(err.stage, "INTAKE");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "STAGE_ALREADY_RAN");

  const intake = left.env.stages.intake as any;

  assert.equal(intake.hasRun, true);
  assert.equal(intake.proposal.fingerprint, "fp_1");
  assert.deepEqual(intake.proposal.rawProposal, { a: 1 });
});
