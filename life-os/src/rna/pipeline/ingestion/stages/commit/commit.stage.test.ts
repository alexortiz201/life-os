import test from "node:test";
import assert from "node:assert/strict";

import { commitStage } from "#/rna/pipeline/ingestion/stages/commit/commit.stage";
import type { IngestionPipelineEnvelope } from "#/rna/pipeline/ingestion/ingestion.types";
import {
  assertMatchId,
  makeEnv,
  resetStagesUpTo,
  unwrapRight,
  unwrapLeft,
  makeValidEffectsLog,
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
        effectType: "ARTIFACT",
        objectId: "note_1",
        kind: "NOTE",
        trust: "PROVISIONAL",
      },
      {
        effectType: "ARTIFACT",
        objectId: "report_1",
        kind: "REPORT",
        trust: "PROVISIONAL",
      },
      {
        effectType: "ARTIFACT",
        objectId: "note_2",
        kind: "NOTE",
        trust: "COMMITTED",
      },
      {
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
  }
});

// test("commits nothing if there are no PROVISIONAL artifacts", () => {
//   const env = makeCommitEnv({
//     stages: {
//       revalidation: {
//         directive: { outcome: "APPROVE_COMMIT", commitAllowList: [] },
//         effectsLog: {
//           producedEffects: [
//             {
//               effectType: "ARTIFACT",
//               objectId: "note_2",
//               kind: "NOTE",
//               trust: "COMMITTED",
//             },
//             {
//               effectType: "ARTIFACT",
//               objectId: "raw_1",
//               kind: "RAW",
//               trust: "UNTRUSTED",
//             },
//           ],
//         },
//       } as any,
//     },
//   });

//   const out = commitStage(env);
//   const nextEnv = unwrapRight(out);

//   assert.equal(nextEnv.errors.length, 0);

//   const c = getCommitRecord(nextEnv);
//   assert.equal(c.effects.approved.length, 0);
//   assert.equal(c.promotions.length, 0);
// });

// test("fails closed when revalidation.proposalId mismatches envelope proposalId", () => {
//   const env = makeCommitEnv({
//     ids: { proposalId: "proposal_1" },
//     stages: {
//       revalidation: {
//         directive: { proposalId: "proposal_X", outcome: "APPROVE_COMMIT" },
//         effectsLog: {
//           proposalId: "proposal_1",
//           effectsLogId: "effects_1",
//           producedEffects: [],
//         },
//       } as any,
//     },
//   });

//   const out = commitStage(env);
//   const left = unwrapLeft(out);

//   // commitStage now returns Left on guard failure; env is carried on the left
//   assert.ok(left.env.errors.length >= 1);

//   const err = lastError(left.env) as any;
//   assert.equal(err.stage, "COMMIT");
//   assert.equal(err.severity, "HALT");
//   assert.equal(err.code, "COMMIT_INPUT_MISMATCH");

//   // stage output should not be marked as run on failure
//   assert.equal(left.env.stages.commit.hasRun, false);
// });

// test("fails closed on unsupported outcome (REJECT_COMMIT)", () => {
//   const env = makeCommitEnv({
//     stages: {
//       revalidation: {
//         directive: { outcome: "REJECT_COMMIT", commitAllowList: [] },
//         effectsLog: {
//           proposalId: "proposal_1",
//           effectsLogId: "effects_1",
//           producedEffects: [],
//         },
//       } as any,
//     },
//   });

//   const out = commitStage(env);
//   const left = unwrapLeft(out);

//   const err = lastError(left.env) as any;
//   assert.equal(err.stage, "COMMIT");
//   assert.equal(err.severity, "HALT");
//   assert.equal(err.code, "COMMIT_OUTCOME_UNSUPPORTED");

//   assert.equal(left.env.stages.commit.hasRun, false);
// });

// test("PARTIAL_COMMIT with empty allowlist commits nothing (but emits commit record)", () => {
//   const env = makeCommitEnv({
//     stages: {
//       revalidation: {
//         directive: { outcome: "PARTIAL_COMMIT", commitAllowList: [] },
//         effectsLog: {
//           proposalId: "proposal_1",
//           effectsLogId: "effects_1",
//           producedEffects: [
//             {
//               effectType: "ARTIFACT",
//               objectId: "note_1",
//               kind: "NOTE",
//               trust: "PROVISIONAL",
//             },
//           ],
//         },
//       } as any,
//     },
//   });

//   const out = commitStage(env);
//   const nextEnv = unwrapRight(out);

//   assert.equal(nextEnv.errors.length, 0);

//   const c = getCommitRecord(nextEnv);
//   assert.equal(c.effects.approved.length, 0);
//   assert.equal(c.promotions.length, 0);
// });

// test("PARTIAL_COMMIT commits only allowlisted PROVISIONAL artifacts", () => {
//   const env = makeCommitEnv({
//     stages: {
//       revalidation: {
//         directive: { outcome: "PARTIAL_COMMIT", commitAllowList: ["note_1"] },
//         effectsLog: {
//           proposalId: "proposal_1",
//           effectsLogId: "effects_1",
//           producedEffects: [
//             {
//               effectType: "ARTIFACT",
//               objectId: "note_1",
//               kind: "NOTE",
//               trust: "PROVISIONAL",
//             },
//             {
//               effectType: "ARTIFACT",
//               objectId: "report_1",
//               kind: "REPORT",
//               trust: "PROVISIONAL",
//             },
//           ],
//         },
//       } as any,
//     },
//   });

//   const out = commitStage(env);
//   const nextEnv = unwrapRight(out);

//   assert.equal(nextEnv.errors.length, 0);

//   const c = getCommitRecord(nextEnv);
//   assert.equal(c.effects.approved.length, 1);
//   assert.equal(c.effects.approved[0].objectId, "note_1");
//   assert.equal(c.promotions.length, 1);
//   assert.equal(c.promotions[0].objectId, "note_1");
// });

// test("PARTIAL_COMMIT fails when allowlist references unknown objects", () => {
//   const env = makeCommitEnv({
//     stages: {
//       revalidation: {
//         directive: { outcome: "PARTIAL_COMMIT", commitAllowList: ["ghost_id"] },
//         effectsLog: {
//           proposalId: "proposal_1",
//           effectsLogId: "effects_1",
//           producedEffects: [
//             {
//               effectType: "ARTIFACT",
//               objectId: "note_1",
//               kind: "NOTE",
//               trust: "PROVISIONAL",
//             },
//           ],
//         },
//       } as any,
//     },
//   });

//   const out = commitStage(env);
//   const left = unwrapLeft(out);

//   assert.equal(left.env.stages.commit.hasRun, false);

//   const err = lastError(left.env) as any;
//   assert.equal(err.stage, "COMMIT");
//   assert.equal(err.severity, "HALT");
//   assert.equal(err.code, "ALLOWLIST_UNKNOWN_OBJECT");
// });

// test("does not emit promotions for non-PROVISIONAL artifacts (records rejectedEffects)", () => {
//   const env = makeCommitEnv({
//     stages: {
//       revalidation: {
//         directive: {
//           outcome: "APPROVE_COMMIT",
//           commitAllowList: ["note_2", "raw_1"],
//         },
//         effectsLog: {
//           proposalId: "proposal_1",
//           effectsLogId: "effects_1",
//           producedEffects: [
//             {
//               effectType: "ARTIFACT",
//               objectId: "note_2",
//               kind: "NOTE",
//               trust: "COMMITTED",
//             },
//             {
//               effectType: "ARTIFACT",
//               objectId: "raw_1",
//               kind: "RAW",
//               trust: "UNTRUSTED",
//             },
//           ],
//         },
//       } as any,
//     },
//   });

//   const out = commitStage(env);
//   const nextEnv = unwrapRight(out);

//   assert.equal(nextEnv.errors.length, 0);

//   const c = getCommitRecord(nextEnv);
//   assert.equal(c.effects.approved.length, 0);
//   assert.equal(c.promotions.length, 0);

//   // coverage: rejectedEffects should be recorded (guardCommit precomputes these)
//   assert.ok(Array.isArray(c.effects.rejected));
//   assert.deepEqual(c.effects.rejected.map((e: any) => e.objectId).sort(), [
//     "note_2",
//     "raw_1",
//   ]);
// });

// ///////////////// Commit Apply Tests

// // NOTE: REJECT_COMMIT is treated as unsupported by guardCommit, so commitStage returns Left.
// // Keeping this test skipped unless you change guard behavior.
// test.skip("REJECT_COMMIT does not include apply state", () => {
//   const env = makeCommitEnv({
//     ids: { proposalId: "test_reject_commit" },
//     stages: {
//       revalidation: {
//         directive: {
//           proposalId: "test_reject_commit",
//           commitAllowList: [],
//           outcome: "REJECT_COMMIT",
//           rulesApplied: ["DRIFT_DETECTED"],
//         },
//         effectsLog: {
//           proposalId: "test_reject_commit",
//           effectsLogId: "effects_1",
//           producedEffects: [],
//         },
//       } as any,
//     },
//   });

//   const out = commitStage(env);
//   const nextEnv = unwrapRight(out);

//   const c = getCommitRecord(nextEnv);
//   assert.equal(c.outcome, "REJECT_COMMIT");

//   // 🔒 invariant: apply must not exist
//   assert.equal(c.apply, undefined);
// });

// test("HALT in commit stage does not create apply state", () => {
//   const env = makeCommitEnv({
//     stages: {
//       revalidation: {
//         hasRun: false,
//       } as any,
//     },
//   });

//   const out = commitStage(env);
//   const left = unwrapLeft(out);

//   assert.ok(left.env.errors.length >= 1);

//   const err = lastError(left.env) as any;
//   assert.equal(err.stage, "COMMIT");
//   assert.equal(err.severity, "HALT");

//   const c = left.env.stages.commit as any;
//   assert.equal(c.hasRun, false);
//   assert.equal(c.apply, undefined);
// });

// test("APPROVE_COMMIT initializes apply state as PENDING", () => {
//   const env = makeCommitEnv({
//     stages: {
//       revalidation: {
//         directive: {
//           commitAllowList: [],
//           outcome: "APPROVE_COMMIT",
//         },
//         effectsLog: {
//           proposalId: "proposal_1",
//           effectsLogId: "effects_1",
//           producedEffects: [],
//         },
//       } as any,
//     },
//   });

//   const out = commitStage(env);
//   const nextEnv = unwrapRight(out);

//   assert.equal(nextEnv.errors.length, 0);
//   assert.equal(nextEnv.stages.commit.hasRun, true);

//   const c = nextEnv.stages.commit as any;

//   assert.equal(c.outcome, "APPROVE_COMMIT");
//   assert.ok(c.apply);

//   assert.equal(c.apply.status, "PENDING");
//   assert.equal(c.apply.attempts, 0);
//   assert.equal(c.apply.lastError, undefined);
//   assert.equal(c.apply.appliedAt, undefined);
// });

// test("PARTIAL_COMMIT initializes apply state as PENDING", () => {
//   const env = makeCommitEnv({
//     stages: {
//       revalidation: {
//         directive: {
//           outcome: "PARTIAL_COMMIT",
//           commitAllowList: ["note_1"],
//           rulesApplied: ["NON_ARTIFACT_EFFECTS_PRESENT"],
//         },
//         effectsLog: {
//           proposalId: "proposal_1",
//           effectsLogId: "effects_1",
//           producedEffects: [
//             {
//               effectType: "ARTIFACT",
//               objectId: "note_1",
//               kind: "NOTE",
//               trust: "PROVISIONAL",
//             },
//           ],
//         },
//       } as any,
//     },
//   });

//   const out = commitStage(env);
//   const nextEnv = unwrapRight(out);

//   assert.equal(nextEnv.errors.length, 0);
//   assert.equal(nextEnv.stages.commit.hasRun, true);

//   const c = nextEnv.stages.commit as any;

//   assert.equal(c.outcome, "PARTIAL_COMMIT");
//   assert.ok(c.apply);
//   assert.equal(c.apply.status, "PENDING");
// });
