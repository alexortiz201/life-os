import test from "node:test";
import assert from "node:assert/strict";
import { guardPrecommit } from "#/rna/pipelines/ingestion/stages/commit/precommit.guard";
import { CommitInput } from "#/types/rna/pipeline/ingestion/commit/commit.types";

/**
 * These tests define the *minimum contract* your guard must satisfy.
 *
 * Expected return shape:
 *  - { ok: true, data: { parsed?: unknown, approvedEffects: Array<{ objectId: string }>, mode: "FULL" | "PARTIAL" } }
 *  - { ok: false, code: string, message: string }
 *
 * Notes:
 *  - You can include more fields in `data` if you want (proposalId, effectsLogId, etc.)
 *  - Tests only depend on: ok/code + approvedEffects + mode.
 */

function makeInput(overrides?: Partial<any>): CommitInput {
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
    ...overrides,
  };
}

function ids(x: any): string[] {
  return (x as Array<any>).map((o) => o.objectId).sort();
}

test("INVALID_COMMIT_INPUT when input shape is wrong", () => {
  const result = guardPrecommit({
    // missing proposalId, revalidation, effectsLog
    nope: true,
  } as any);

  assert.equal((result as any).ok, false);
  if (!(result as any).ok) {
    assert.equal((result as any).code, "INVALID_COMMIT_INPUT");
    assert.equal(typeof (result as any).message, "string");
  }
});

test("COMMIT_INPUT_MISMATCH when revalidation.proposalId does not match proposalId", () => {
  const result = guardPrecommit(
    makeInput({
      revalidation: { ...makeInput().revalidation, proposalId: "proposal_X" },
    })
  );

  assert.equal((result as any).ok, false);
  if (!(result as any).ok)
    assert.equal((result as any).code, "COMMIT_INPUT_MISMATCH");
});

test("COMMIT_INPUT_MISMATCH when effectsLog.proposalId does not match proposalId", () => {
  const result = guardPrecommit(
    makeInput({
      effectsLog: { ...makeInput().effectsLog, proposalId: "proposal_X" },
    })
  );

  assert.equal((result as any).ok, false);
  if (!(result as any).ok)
    assert.equal((result as any).code, "COMMIT_INPUT_MISMATCH");
});

test("COMMIT_OUTCOME_UNSUPPORTED when outcome is not APPROVE_COMMIT or PARTIAL_COMMIT", () => {
  const result = guardPrecommit(
    makeInput({
      revalidation: {
        proposalId: "proposal_1",
        outcome: "REJECT_COMMIT",
        commitAllowList: [],
      },
    })
  );

  assert.equal((result as any).ok, false);
  if (!(result as any).ok)
    assert.equal((result as any).code, "COMMIT_OUTCOME_UNSUPPORTED");
});

test("APPROVE_COMMIT returns FULL mode and approvedEffects includes all PROVISIONAL produced objects (ignores allowlist)", () => {
  const result = guardPrecommit(
    makeInput({
      revalidation: {
        proposalId: "proposal_1",
        outcome: "APPROVE_COMMIT",
        // intentionally weird allowlist: should be ignored for full approval
        commitAllowList: ["ghost_id", "note_2"],
      },
    })
  );

  assert.equal((result as any).ok, true);
  if ((result as any).ok) {
    assert.equal((result as any).data.mode, "FULL");

    // Only provisional objects should be eligible: note_1 + report_1
    assert.deepEqual(ids((result as any).data.commitEligibleEffects), [
      "note_1",
      "report_1",
    ]);
  }
});

test("PARTIAL_COMMIT with empty allowlist returns ok and empty approvedEffects", () => {
  const result = guardPrecommit(
    makeInput({
      revalidation: {
        proposalId: "proposal_1",
        outcome: "PARTIAL_COMMIT",
        commitAllowList: [],
      },
      effectsLog: {
        ...makeInput().effectsLog,
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
    })
  );

  assert.equal((result as any).ok, true);
  if ((result as any).ok) {
    assert.equal((result as any).data.mode, "PARTIAL");
    assert.deepEqual((result as any).data.commitEligibleEffects, []);
  }
});

test("ALLOWLIST_UNKNOWN_OBJECT when PARTIAL_COMMIT allowlist references an objectId not in producedEffects", () => {
  const result = guardPrecommit(
    makeInput({
      revalidation: {
        proposalId: "proposal_1",
        outcome: "PARTIAL_COMMIT",
        commitAllowList: ["note_1", "ghost_id"],
      },
      effectsLog: {
        ...makeInput().effectsLog,
        producedEffects: [
          {
            effectType: "ARTIFACT",
            objectId: "note_1",
            kind: "NOTE",
            trust: "PROVISIONAL",
          },
        ],
      },
    })
  );

  assert.equal((result as any).ok, false);
  if (!(result as any).ok)
    assert.equal((result as any).code, "ALLOWLIST_UNKNOWN_OBJECT");
});

test("PARTIAL_COMMIT approvedEffects includes only allowlisted objects that are PROVISIONAL (not COMMITTED/UNTRUSTED)", () => {
  const result = guardPrecommit(
    makeInput({
      revalidation: {
        proposalId: "proposal_1",
        outcome: "PARTIAL_COMMIT",
        commitAllowList: ["note_1", "note_2", "raw_1", "report_1"],
      },
      effectsLog: {
        ...makeInput().effectsLog,
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
    })
  );

  assert.equal((result as any).ok, true);
  if ((result as any).ok) {
    assert.equal((result as any).data.mode, "PARTIAL");

    // allowlist may include non-provisional ids; approvedEffects must filter them out
    assert.deepEqual(ids((result as any).data.commitEligibleEffects), [
      "note_1",
      "report_1",
    ]);
  }
});
