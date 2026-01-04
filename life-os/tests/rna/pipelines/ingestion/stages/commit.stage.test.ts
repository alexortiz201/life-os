import test from "node:test";
import assert from "node:assert/strict";
import { commitStage } from "#/rna/pipelines/ingestion/stages/commit.stage";

function makeInput(overrides?: Partial<any>) {
  return {
    proposalId: "proposal_1",
    revalidation: {
      proposalId: "proposal_1",
      outcome: "APPROVE_COMMIT",
      commitAllowList: ["note_1", "report_1"],
    },
    effectsLog: {
      effectsLogId: "effects_1",
      proposalId: "proposal_1",
      producedObjects: [
        { objectId: "note_1", kind: "NOTE", trust: "PROVISIONAL" },
        { objectId: "report_1", kind: "REPORT", trust: "PROVISIONAL" },
        { objectId: "note_2", kind: "NOTE", trust: "COMMITTED" },
        { objectId: "raw_1", kind: "RAW", trust: "UNTRUSTED" },
      ],
    },
    ...overrides,
  };
}

test("commits only PROVISIONAL produced objects", () => {
  const result = commitStage(makeInput());

  assert.equal(result.proposalId, "proposal_1");
  assert.match(result.commitId, /^commit_\d+$/);

  // Only two provisional objects should be promoted
  assert.equal(result.committedObjects.length, 2);
  assert.deepEqual(
    result.committedObjects.map((o) => o.objectId).sort(),
    ["note_1", "report_1"].sort()
  );

  for (const obj of result.committedObjects) {
    assert.equal(obj.trust, "COMMITTED");
  }
});

test("commits nothing if there are no PROVISIONAL objects", () => {
  const result = commitStage(
    makeInput({
      revalidation: {
        ...makeInput().revalidation,
        commitAllowList: [],
      },
      effectsLog: {
        ...makeInput().effectsLog,
        producedObjects: [
          { objectId: "note_2", kind: "NOTE", trust: "COMMITTED" },
          { objectId: "raw_1", kind: "RAW", trust: "UNTRUSTED" },
        ],
      },
    })
  );

  assert.equal(result.committedObjects.length, 0);
});

test("throws if revalidation.proposalId does not match proposalId", () => {
  assert.throws(() => {
    commitStage(
      makeInput({
        revalidation: { proposalId: "proposal_X", outcome: "APPROVE_COMMIT" },
      })
    );
  }, /COMMIT_INPUT_MISMATCH/);
});

test("throws if effectsLog.proposalId does not match proposalId", () => {
  assert.throws(() => {
    commitStage(
      makeInput({
        effectsLog: { ...makeInput().effectsLog, proposalId: "proposal_X" },
      })
    );
  }, /COMMIT_INPUT_MISMATCH/);
});

test("fails closed on anything not APPROVE_COMMIT or PARTIAL_COMMIT (minimal behavior)", () => {
  assert.throws(() => {
    commitStage(
      makeInput({
        revalidation: { proposalId: "proposal_1", outcome: "REJECT_COMMIT" },
      })
    );
  }, /COMMIT_OUTCOME_UNSUPPORTED/);
});

test("empty allowlist when PARTIAL_COMMIT commits nothing", () => {
  const result = commitStage(
    makeInput({
      revalidation: {
        proposalId: "proposal_1",
        outcome: "PARTIAL_COMMIT",
        commitAllowList: [],
      },
      effectsLog: {
        ...makeInput().effectsLog,
        producedObjects: [
          { objectId: "note_1", kind: "NOTE", trust: "PROVISIONAL" },
        ],
      },
    })
  );

  assert.equal(result.proposalId, "proposal_1");
  assert.match(result.commitId, /^commit_\d+$/);

  // Only two provisional objects should be promoted
  assert.equal(result.committedObjects.length, 0);
  assert.deepEqual(result.committedObjects, []);
});

test("rejects allowlisted objects when PARTIAL_COMMIT that aren’t PROVISIONAL", () => {
  assert.throws(() => {
    commitStage(
      makeInput({
        revalidation: {
          ...makeInput().revalidation,
          commitAllowList: ["ghost_id"],
        },
        effectsLog: {
          ...makeInput().effectsLog,
          producedObjects: [
            { objectId: "note_1", kind: "NOTE", trust: "PROVISIONAL" },
          ],
        },
      })
    );
  }, /ALLOWLIST_UNKNOWN_OBJECT/);
});

// -------------------------
// C1 — one promotion record per committed object (APPROVE_COMMIT)
// -------------------------
test("emits one promotion record per committed object", () => {
  const result = commitStage(makeInput());

  // You will add: result.promotions
  assert.ok(Array.isArray((result as any).promotions), "promotions must exist");

  const promotions = (result as any).promotions as Array<any>;

  // only note_1 + report_1 are committed
  assert.equal(promotions.length, 2);

  // each promotion should correspond to a committed object
  const committedIds = result.committedObjects.map((o) => o.objectId).sort();
  const promotedIds = promotions.map((p) => p.objectId).sort();
  assert.deepEqual(promotedIds, committedIds);

  for (const p of promotions) {
    assert.equal(p.proposalId, result.proposalId);
    assert.equal(p.effectsLogId, "effects_1");
    assert.equal(p.commitId, result.commitId);

    assert.equal(p.from, "PROVISIONAL");
    assert.equal(p.to, "COMMITTED");
    assert.equal(p.stage, "COMMIT");

    assert.equal(typeof p.reason, "string");
    assert.ok(p.reason.length > 0);
  }
});

// -------------------------
// C2 — PARTIAL_COMMIT emits promotions only for allowlisted commits
// -------------------------
test("PARTIAL_COMMIT emits promotion records only for allowlisted objects", () => {
  const result = commitStage(
    makeInput({
      revalidation: {
        proposalId: "proposal_1",
        outcome: "PARTIAL_COMMIT",
        commitAllowList: ["note_1"],
      },
      effectsLog: {
        ...makeInput().effectsLog,
        producedObjects: [
          { objectId: "note_1", kind: "NOTE", trust: "PROVISIONAL" },
          { objectId: "report_1", kind: "REPORT", trust: "PROVISIONAL" },
        ],
      },
    })
  );

  assert.ok(Array.isArray((result as any).promotions), "promotions must exist");
  const promotions = (result as any).promotions as Array<any>;

  // only allowlisted note_1 is committed
  assert.equal(result.committedObjects.length, 1);
  assert.equal(result.committedObjects[0]?.objectId, "note_1");

  assert.equal(promotions.length, 1);
  assert.equal(promotions[0]?.objectId, "note_1");
});

// -------------------------
// C3 — empty allowlist emits zero promotions
// -------------------------
test("PARTIAL_COMMIT with empty allowlist emits zero promotion records", () => {
  const result = commitStage(
    makeInput({
      revalidation: {
        proposalId: "proposal_1",
        outcome: "PARTIAL_COMMIT",
        commitAllowList: [],
      },
      effectsLog: {
        ...makeInput().effectsLog,
        producedObjects: [
          { objectId: "note_1", kind: "NOTE", trust: "PROVISIONAL" },
        ],
      },
    })
  );

  assert.equal(result.committedObjects.length, 0);

  assert.ok(Array.isArray((result as any).promotions), "promotions must exist");
  const promotions = (result as any).promotions as Array<any>;
  assert.equal(promotions.length, 0);
});

// -------------------------
// C4 — promotions must NOT exist for ignored objects (UNTRUSTED/COMMITTED inputs)
// -------------------------
test("does not emit promotion records for non-PROVISIONAL produced objects", () => {
  const result = commitStage(
    makeInput({
      revalidation: {
        ...makeInput().revalidation,
        commitAllowList: ["note_2", "raw_1"],
      },
      effectsLog: {
        ...makeInput().effectsLog,
        producedObjects: [
          { objectId: "note_2", kind: "NOTE", trust: "COMMITTED" },
          { objectId: "raw_1", kind: "RAW", trust: "UNTRUSTED" },
        ],
      },
    })
  );

  assert.equal(result.committedObjects.length, 0);

  assert.ok(Array.isArray((result as any).promotions), "promotions must exist");
  const promotions = (result as any).promotions as Array<any>;
  assert.equal(promotions.length, 0);
});
