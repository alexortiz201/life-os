import { test, describe, it, expect } from "vitest";

import { intakeStage } from "#/rna/pipeline/ingestion/stages/intake/intake.stage";
import {
  resetStagesUpTo,
  unwrapLeft,
  unwrapRight,
  lastError,
  makeEnv as makeEnvUtil,
} from "#/shared/test-utils";

const makeEnv = () => resetStagesUpTo("intake", makeEnvUtil());

test("appends HALT error when rawProposal missing (structural invalidity)", () => {
  const env = makeEnv();

  // present but structurally invalid
  (env as any).rawProposal = {};

  const out = intakeStage(env as any);
  const left = unwrapLeft(out);

  expect(left.env.stages.intake.hasRun).toBeFalsy();
  expect(left.env.errors.length >= 1).toBeTruthy();

  const err = lastError(left.env) as any;
  expect(err.stage).toBe("INTAKE");
  expect(err.severity).toBe("HALT");
  expect(err.code).toBe("INVALID_INTAKE_INPUT");
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

  expect(nextEnv.errors.length).toBe(0);
  expect(nextEnv.stages.intake.hasRun).toBeTruthy();

  const s = nextEnv.stages.intake as any;
  expect(typeof s.ranAt).toBe("number");
  expect(typeof s.observed.proposalId).toBe("string");
  expect(s.observed.proposalId).toBe(nextEnv.ids.proposalId);
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

  expect(nextEnv.errors.length).toBe(0);
  expect(nextEnv.stages.intake.hasRun).toBeTruthy();

  // stage should create intakeId
  expect(nextEnv.ids.intakeId).toBeTruthy();
  expect(nextEnv.ids.intakeId).toBeTypeOf("string");
  expect(nextEnv.ids.intakeId).toMatch(/^.+$/);
  expect(
    nextEnv.ids.intakeId,
    "intakeId should be set after intake stage",
  ).toBeTruthy();

  const intake = nextEnv.stages.intake as any;

  expect(intake.observed.proposalId).toBe(nextEnv.ids.proposalId);
  expect(intake.proposal.id).toBe(nextEnv.ids.proposalId);
  expect(intake.proposal.proposalId).toBe(nextEnv.ids.proposalId);

  expect(intake.proposal.rawProposal).toEqual(rawProposal);

  expect(typeof intake.proposal.fingerprint).toBe("string");
  expect(intake.proposal.fingerprint.length > 0).toBeTruthy();

  expect(typeof intake.ranAt).toBe("number");
  expect(typeof intake.proposal.intakeTimestamp).toBe("string");
  expect(typeof intake.proposal.createdAt).toBe("string");
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

  expect(next1.errors.length).toBe(0);
  expect(next2.errors.length).toBe(0);

  const fp1 = (next1.stages.intake as any).proposal?.fingerprint;
  const fp2 = (next2.stages.intake as any).proposal?.fingerprint;

  expect(typeof fp1).toBe("string");
  expect(typeof fp2).toBe("string");
  expect(fp1).toBe(fp2);
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

  expect(left.env.errors.length >= 1).toBeTruthy();

  const err = lastError(left.env) as any;
  expect(err.stage).toBe("INTAKE");
  expect(err.severity).toBe("HALT");
  expect(err.code).toBe("STAGE_ALREADY_RAN");

  const intake = left.env.stages.intake as any;

  expect(intake.hasRun).toBeTruthy();
  expect(intake.proposal.fingerprint).toBe("fp_1");
  expect(intake.proposal.rawProposal).toEqual({ a: 1 });
});
