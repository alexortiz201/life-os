import test from "node:test";
import assert from "node:assert/strict";

import { commitStage } from "#/rna/pipelines/ingestion/stages/commit/commit.stage";
import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";
import { makeCommitEnv } from "../../../../../utils";

function lastError(env: IngestionPipelineEnvelope) {
  return env.errors[env.errors.length - 1];
}

function getCommitRecord(env: IngestionPipelineEnvelope) {
  assert.equal(env.stages.commit.hasRun, true, "commit stage must have run");
  return env.stages.commit as any;
}

test("commits only PROVISIONAL produced artifacts", () => {
  const env = makeCommitEnv({
    stages: {
      revalidation: {
        directive: {
          outcome: "APPROVE_COMMIT",
          commitAllowList: ["note_1", "report_1"],
        },
        effectsLog: {
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
        },
      } as any,
    },
  });

  const out = commitStage(env);
  assert.equal(out.errors.length, 0);

  const c = getCommitRecord(out);
  assert.equal(c.proposalId, "proposal_1");
  assert.match(c.commitId, /^commit_\d+$/);

  assert.equal(c.approvedEffects.length, 2);
  assert.deepEqual(c.approvedEffects.map((o: any) => o.objectId).sort(), [
    "note_1",
    "report_1",
  ]);

  for (const obj of c.approvedEffects) {
    assert.equal(obj.trust, "COMMITTED");
  }
});

test("commits nothing if there are no PROVISIONAL artifacts", () => {
  const env = makeCommitEnv({
    stages: {
      revalidation: {
        directive: { outcome: "APPROVE_COMMIT", commitAllowList: [] },
        effectsLog: {
          producedEffects: [
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
        },
      } as any,
    },
  });

  const out = commitStage(env);
  assert.equal(out.errors.length, 0);

  const c = getCommitRecord(out);
  assert.equal(c.approvedEffects.length, 0);
  assert.equal(c.promotions.length, 0);
});

test("fails closed when revalidation.proposalId mismatches envelope proposalId", () => {
  const env = makeCommitEnv({
    ids: { proposalId: "proposal_1" },
    stages: {
      revalidation: {
        directive: { proposalId: "proposal_X", outcome: "APPROVE_COMMIT" },
      } as any,
    },
  });

  const out = commitStage(env);

  assert.equal(out.stages.commit.hasRun, false);
  assert.ok(out.errors.length >= 1);

  const err = lastError(out) as any;
  assert.equal(err.stage, "COMMIT");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "COMMIT_INPUT_MISMATCH");
});

test("fails closed on unsupported outcome (REJECT_COMMIT)", () => {
  const env = makeCommitEnv({
    stages: {
      revalidation: {
        directive: { outcome: "REJECT_COMMIT", commitAllowList: [] },
      } as any,
    },
  });

  const out = commitStage(env);

  assert.equal(out.stages.commit.hasRun, false);
  const err = lastError(out) as any;
  assert.equal(err.stage, "COMMIT");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "COMMIT_OUTCOME_UNSUPPORTED");
});

test("PARTIAL_COMMIT with empty allowlist commits nothing (but emits commit record)", () => {
  const env = makeCommitEnv({
    stages: {
      revalidation: {
        directive: { outcome: "PARTIAL_COMMIT", commitAllowList: [] },
        effectsLog: {
          producedEffects: [
            {
              effectType: "ARTIFACT",
              objectId: "note_1",
              kind: "NOTE",
              trust: "PROVISIONAL",
            },
          ],
        },
      } as any,
    },
  });

  const out = commitStage(env);

  assert.equal(out.errors.length, 0);
  const c = getCommitRecord(out);

  assert.equal(c.approvedEffects.length, 0);
  assert.equal(c.promotions.length, 0);
});

test("PARTIAL_COMMIT commits only allowlisted PROVISIONAL artifacts", () => {
  const env = makeCommitEnv({
    stages: {
      revalidation: {
        directive: { outcome: "PARTIAL_COMMIT", commitAllowList: ["note_1"] },
        effectsLog: {
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
          ],
        },
      } as any,
    },
  });

  const out = commitStage(env);

  assert.equal(out.errors.length, 0);
  const c = getCommitRecord(out);

  assert.equal(c.approvedEffects.length, 1);
  assert.equal(c.approvedEffects[0].objectId, "note_1");
  assert.equal(c.promotions.length, 1);
  assert.equal(c.promotions[0].objectId, "note_1");
});

test("PARTIAL_COMMIT fails when allowlist references unknown objects", () => {
  const env = makeCommitEnv({
    stages: {
      revalidation: {
        directive: { outcome: "PARTIAL_COMMIT", commitAllowList: ["ghost_id"] },
        effectsLog: {
          producedEffects: [
            {
              effectType: "ARTIFACT",
              objectId: "note_1",
              kind: "NOTE",
              trust: "PROVISIONAL",
            },
          ],
        },
      } as any,
    },
  });

  const out = commitStage(env);

  assert.equal(out.stages.commit.hasRun, false);
  const err = lastError(out) as any;
  assert.equal(err.stage, "COMMIT");
  assert.equal(err.severity, "HALT");
  assert.equal(err.code, "ALLOWLIST_UNKNOWN_OBJECT");
});

test("does not emit promotions for non-PROVISIONAL artifacts", () => {
  const env = makeCommitEnv({
    stages: {
      revalidation: {
        directive: {
          outcome: "APPROVE_COMMIT",
          commitAllowList: ["note_2", "raw_1"],
        },
        effectsLog: {
          producedEffects: [
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
        },
      } as any,
    },
  });

  const out = commitStage(env);

  assert.equal(out.errors.length, 0);
  const c = getCommitRecord(out);

  assert.equal(c.approvedEffects.length, 0);
  assert.equal(c.promotions.length, 0);
});
