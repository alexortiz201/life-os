import test from "node:test";
import assert from "node:assert/strict";

import { intakeStage } from "#/rna/pipelines/ingestion/stages/intake/intake.stage";
import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";
import {
  makeEnv as makeEnvUtil,
  makeRawProposalSchema,
  resetStagesUpTo,
} from "../../../../../utils";

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

function lastError(env: IngestionPipelineEnvelope) {
  return env.errors[env.errors.length - 1];
}

test.skip("appends HALT error when RAW_PROPOSAL missing (structural invalidity)", () => {
  const env = makeEnv();

  (env as any).rawProposal = {};

  const out = intakeStage(env as any);

  assert.equal(out.stages.intake.hasRun, false);
  assert.ok(out.errors.length >= 1);

  const err = lastError(out) as any;
  assert.equal(err.stage, "INTAKE");
  assert.equal(err.severity, "HALT");
  // contract says HALT on structural invalidity / missing required fields
  assert.equal(err.code, "INVALID_INTAKE_INPUT");
});

test.skip("does not pre-reject on semantic grounds (intake never judges meaning)", () => {
  const env = makeEnv();

  // Intentionally "weird" / questionable values, but structurally present.
  // Intake should still normalize + record rather than decide.
  (env as any).rawProposal = {
    intent: "do something",
    actor: { actorId: "user_1", actorType: "USER" },
    target: {
      entity: "UNKNOWN_ENTITY",
      scope: { allowedKinds: ["NOTE"] as const },
    },
    dependencies: [],
    impact: "HIGH",
    reversibilityClaim: "UNKNOWN",
  };

  const out = intakeStage(env as any);

  // No HALT just because meaning looks odd (that's validation's job)
  assert.equal(out.errors.length, 0);
  assert.equal(out.stages.intake.hasRun, true);

  const s = out.stages.intake as any;
  assert.equal(typeof s.proposalId, "string");
  // assert.equal(s.proposalId, env.ids.proposalId); // NEED TO FIX !!!!
  assert.ok(typeof s.ranAt === "number");
});

test("writes PROPOSAL_RECORD with stable id + fingerprint + preserved raw payload", () => {
  const env = makeEnv();

  (env as any).rawProposal = makeRawProposalSchema();

  const out = intakeStage(env as any);

  assert.equal(out.errors.length, 0);
  assert.equal(out.stages.intake.hasRun, true);

  const intake = out.stages.intake as any;

  // must contain stable id
  assert.equal(intake.proposalId, env.ids.proposalId);

  // must preserve raw intent verbatim (or inside preserved_raw_payload)
  assert.ok(intake.proposalRecord);
  assert.deepEqual(
    intake.proposalRecord.preservedRawPayload ??
      intake.proposalRecord.rawProposal,
    (env as any).rawProposal
  );

  // must have fingerprint
  assert.equal(typeof intake.proposalRecord.fingerprint, "string");
  assert.ok(intake.proposalRecord.fingerprint.length > 0);

  // must have canonical ordering / normalized fields (shape-level assertion)
  assert.ok(
    typeof intake.proposalRecord === "object" && intake.proposalRecord !== null
  );
});

// test("determinism: identical rawProposal inputs produce identical fingerprints", () => {
//   const env1 = makeEnv();
//   const env2 = makeEnv();

//   // Use same proposalId to isolate fingerprint determinism to normalized input.
//   env2.ids.proposalId = env1.ids.proposalId;

//   const raw = makeRawProposalSchema();

//   (env1 as any).rawProposal = raw;
//   (env2 as any).rawProposal = { ...raw };

//   const out1 = intakeStage(env1 as any);
//   const out2 = intakeStage(env2 as any);

//   const fp1 = (out1.stages.intake as any).proposalRecord?.fingerprint;
//   const fp2 = (out2.stages.intake as any).proposalRecord?.fingerprint;

//   assert.equal(out1.errors.length, 0);
//   assert.equal(out2.errors.length, 0);
//   assert.equal(typeof fp1, "string");
//   assert.equal(typeof fp2, "string");
//   assert.equal(fp1, fp2);
// });

// test("immutability: if intake stage already hasRun, stage should not overwrite existing record", () => {
//   const env = makeEnv();

//   // Simulate already-run intake
//   (env.stages.intake as any) = {
//     ...(env.stages.intake as any),
//     hasRun: true,
//     intakeId: env.ids.intakeId,
//     proposalId: env.ids.proposalId,
//     proposalRecord: { fingerprint: "fp_1", preservedRawPayload: { a: 1 } },
//   };

//   // Provide new rawProposal that would otherwise change fingerprint/record
//   (env as any).rawProposal = makeRawProposalSchema();
//   (env as any).rawProposal.intent = "DIFFERENT";

//   const out = intakeStage(env as any);

//   // Expect fail-closed: either no-op OR HALT, but must not silently mutate record.
//   const intake = out.stages.intake as any;

//   assert.equal(intake.hasRun, true);
//   assert.equal(intake.proposalRecord.fingerprint, "fp_1");
//   assert.deepEqual(intake.proposalRecord.preservedRawPayload, { a: 1 });
// });
