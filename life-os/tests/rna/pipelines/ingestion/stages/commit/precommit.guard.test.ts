import test from "node:test";
import assert from "node:assert/strict";

import { guardPrecommit } from "#/rna/pipelines/ingestion/stages/commit/precommit.guard";
import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";
import { makeCommitEnv } from "../../../../../utils"; // adjust relative import if needed

function patchEnv(
  patch: Partial<IngestionPipelineEnvelope>
): IngestionPipelineEnvelope {
  // if your makeCommitEnv already deep merges stages.revalidation.directive/effectsLog,
  // this is enough:
  return makeCommitEnv(patch as any);
}

function ids(x: any): string[] {
  return (x as Array<any>).map((o) => o.objectId).sort();
}

test("INVALID_COMMIT_INPUT when input shape is wrong", () => {
  const result = guardPrecommit({ nope: true } as any);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "INVALID_COMMIT_INPUT");
    assert.equal(typeof result.message, "string");
  }
});

test("COMMIT_INPUT_MISMATCH when revalidation.proposalId does not match proposalId", () => {
  const env = patchEnv({
    ids: { proposalId: "proposal_1" },
    stages: {
      revalidation: {
        ...(makeCommitEnv().stages.revalidation as any),
        directive: {
          ...(makeCommitEnv().stages.revalidation as any).directive,
          proposalId: "proposal_X",
          outcome: "APPROVE_COMMIT",
        },
      } as any,
    } as any,
  });

  const result = guardPrecommit(env);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "COMMIT_INPUT_MISMATCH");
  }
});

test("COMMIT_INPUT_MISMATCH when effectsLog.proposalId does not match proposalId", () => {
  const env = patchEnv({
    ids: { proposalId: "proposal_1" },
    stages: {
      revalidation: {
        ...(makeCommitEnv().stages.revalidation as any),
        effectsLog: {
          ...(makeCommitEnv().stages.revalidation as any).effectsLog,
          proposalId: "proposal_X",
        },
      } as any,
    } as any,
  });

  const result = guardPrecommit(env);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "COMMIT_INPUT_MISMATCH");
  }
});

test("COMMIT_OUTCOME_UNSUPPORTED when outcome is not APPROVE_COMMIT or PARTIAL_COMMIT", () => {
  const env = patchEnv({
    stages: {
      revalidation: {
        ...(makeCommitEnv().stages.revalidation as any),
        directive: {
          ...(makeCommitEnv().stages.revalidation as any).directive,
          outcome: "REJECT_COMMIT",
          commitAllowList: [],
        },
      } as any,
    } as any,
  });

  const result = guardPrecommit(env);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "COMMIT_OUTCOME_UNSUPPORTED");
  }
});

test("APPROVE_COMMIT returns FULL mode and commitEligibleEffects includes all PROVISIONAL artifacts (ignores allowlist)", () => {
  const env = patchEnv({
    stages: {
      revalidation: {
        ...(makeCommitEnv().stages.revalidation as any),
        directive: {
          ...(makeCommitEnv().stages.revalidation as any).directive,
          outcome: "APPROVE_COMMIT",
          commitAllowList: ["ghost_id", "note_2"], // should be ignored in FULL
        },
      } as any,
    } as any,
  });

  const result = guardPrecommit(env);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.mode, "FULL");
    assert.deepEqual(ids(result.data.commitEligibleEffects), [
      "note_1",
      "report_1",
    ]);
  }
});

test("PARTIAL_COMMIT with empty allowlist returns ok and empty commitEligibleEffects", () => {
  const env = patchEnv({
    stages: {
      revalidation: {
        ...(makeCommitEnv().stages.revalidation as any),
        directive: {
          ...(makeCommitEnv().stages.revalidation as any).directive,
          outcome: "PARTIAL_COMMIT",
          commitAllowList: [],
        },
      } as any,
    } as any,
  });

  const result = guardPrecommit(env);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.mode, "PARTIAL");
    assert.deepEqual(result.data.commitEligibleEffects, []);
  }
});

test("ALLOWLIST_UNKNOWN_OBJECT when PARTIAL_COMMIT allowlist references an id not in produced ARTIFACT ids", () => {
  const env = patchEnv({
    stages: {
      revalidation: {
        ...(makeCommitEnv().stages.revalidation as any),
        effectsLog: {
          ...(makeCommitEnv().stages.revalidation as any).effectsLog,
          producedEffects: [
            {
              effectType: "ARTIFACT",
              objectId: "note_1",
              kind: "NOTE",
              trust: "PROVISIONAL",
            },
          ],
        },
        directive: {
          ...(makeCommitEnv().stages.revalidation as any).directive,
          outcome: "PARTIAL_COMMIT",
          commitAllowList: ["note_1", "ghost_id"],
        },
      } as any,
    } as any,
  });

  const result = guardPrecommit(env);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "ALLOWLIST_UNKNOWN_OBJECT");
  }
});

test("PARTIAL_COMMIT selects only allowlisted PROVISIONAL artifacts (filters COMMITTED/UNTRUSTED)", () => {
  const env = patchEnv({
    stages: {
      revalidation: {
        ...(makeCommitEnv().stages.revalidation as any),
        effectsLog: {
          ...(makeCommitEnv().stages.revalidation as any).effectsLog,
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
        directive: {
          ...(makeCommitEnv().stages.revalidation as any).directive,
          outcome: "PARTIAL_COMMIT",
          commitAllowList: ["note_1", "note_2", "raw_1", "report_1"],
        },
      } as any,
    } as any,
  });

  const result = guardPrecommit(env);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.mode, "PARTIAL");
    assert.deepEqual(ids(result.data.commitEligibleEffects), [
      "note_1",
      "report_1",
    ]);
  }
});
