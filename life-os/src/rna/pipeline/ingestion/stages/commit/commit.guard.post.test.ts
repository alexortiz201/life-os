import { test, expect } from "vitest";

import {
  guardCommit,
  postGuardCommit,
} from "#/rna/pipeline/ingestion/stages/commit/commit.guard";

import { makeEnv as makeEnvUtil, resetStagesUpTo } from "#/shared/test-utils";

const makeEnv = () => resetStagesUpTo("commit", makeEnvUtil());

function runPostGuard(env: any) {
  const parsed = guardCommit(env as any);
  if (!parsed.ok)
    throw new Error("guardCommit must succeed for postGuard tests");

  return postGuardCommit({ data: parsed.data } as any);
}

function artifactIds(xs: any[]) {
  return xs.map((o) => o.objectId).sort();
}

//////////////////// PostGuardCommit
test("COMMIT_INPUT_MISMATCH when revalidation.proposalId does not match proposalId", () => {
  const env = makeEnv();

  (env.stages.revalidation as any).proposalId = "proposal_X";

  const result = runPostGuard(env);

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.code).toBe("COMMIT_INPUT_MISMATCH");
    expect(result.trace?.rulesApplied).toContain(
      "PROPOSAL_ID_MISMATCH_REVALIDATION",
    );
  }
});

test("COMMIT_INPUT_MISMATCH when effectsLog.proposalId does not match proposalId", () => {
  const env = makeEnv();

  (env.stages.execution as any).effectsLog = {
    ...(env.stages.execution as any).effectsLog,
    proposalId: "proposal_X",
  };

  const result = runPostGuard(env);

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.code).toBe("COMMIT_INPUT_MISMATCH");
    expect(result.trace?.rulesApplied).toContain(
      "PROPOSAL_ID_MISMATCH_EFFECTS_LOG",
    );
  }
});

test("COMMIT_OUTCOME_UNSUPPORTED when outcome is not APPROVE_COMMIT or PARTIAL_COMMIT", () => {
  const env = makeEnv();

  (env.stages.revalidation as any).directive.outcome = "REJECT_COMMIT";

  const result = runPostGuard(env);

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.code).toBe("COMMIT_OUTCOME_UNSUPPORTED");
    expect(result.trace?.rulesApplied).toContain("OUTCOME_UNSUPPORTED");
  }
});

test("PARTIAL_COMMIT + empty allowlist commits nothing", () => {
  const env = makeEnv();

  (env.stages.revalidation as any).directive = {
    ...(env.stages.revalidation as any).directive,
    outcome: "PARTIAL_COMMIT",
    commitAllowList: [],
  };

  const result = runPostGuard(env);

  expect(result.ok).toBeTruthy();
  if (result.ok) {
    expect(result.data.mode).toBe("PARTIAL");
    expect(result.data.effects.eligible.artifacts).toEqual([]);
    expect(result.data.rulesApplied).toContain(
      "PARTIAL_EMPTY_ALLOWLIST_COMMITS_NOTHING",
    );
  }
});

test("ALLOWLIST_UNKNOWN_OBJECT when PARTIAL_COMMIT allowlist references unknown artifact id", () => {
  const env = makeEnv();

  (env.stages.execution as any).effectsLog.producedEffects = [
    {
      stableId: "producedEffect_1",
      effectType: "ARTIFACT",
      objectId: "note_1",
      kind: "NOTE",
      trust: "PROVISIONAL",
    },
  ];

  (env.stages.revalidation as any).directive = {
    ...(env.stages.revalidation as any).directive,
    outcome: "PARTIAL_COMMIT",
    commitAllowList: ["note_1", "ghost_id"],
  };

  const result = runPostGuard(env);

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.code).toBe("ALLOWLIST_UNKNOWN_OBJECT");
    expect(result.trace?.rulesApplied).toContain(
      "PARTIAL_ALLOWLIST_HAS_UNKNOWN_IDS",
    );
  }
});

test("PARTIAL_COMMIT selects only allowlisted PROVISIONAL artifacts", () => {
  const env = makeEnv();

  (env.stages.execution as any).effectsLog.producedEffects = [
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
      objectId: "note_2",
      kind: "NOTE",
      trust: "COMMITTED",
    },
    {
      stableId: "producedEffect_3",
      effectType: "ARTIFACT",
      objectId: "report_1",
      kind: "REPORT",
      trust: "PROVISIONAL",
    },
  ];

  (env.stages.revalidation as any).directive = {
    ...(env.stages.revalidation as any).directive,
    outcome: "PARTIAL_COMMIT",
    commitAllowList: ["note_1", "note_2", "report_1"],
  };

  const result = runPostGuard(env);

  expect(result.ok).toBeTruthy();
  if (result.ok) {
    expect(result.data.mode).toBe("PARTIAL");

    expect(artifactIds(result.data.effects.eligible.artifacts)).toEqual([
      "note_1",
      "report_1",
    ]);

    expect(result.data.rulesApplied).toContain("PARTIAL_COMMIT_USE_ALLOWLIST");
  }
});

test("FULL commit includes all PROVISIONAL artifacts and ignores allowlist", () => {
  const env = makeEnv();

  (env.stages.execution as any).effectsLog.producedEffects = [
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
      objectId: "note_2",
      kind: "NOTE",
      trust: "COMMITTED",
    },
    {
      stableId: "producedEffect_3",
      effectType: "ARTIFACT",
      objectId: "report_1",
      kind: "REPORT",
      trust: "PROVISIONAL",
    },
  ];

  (env.stages.revalidation as any).directive = {
    ...(env.stages.revalidation as any).directive,
    outcome: "APPROVE_COMMIT",
    commitAllowList: ["note_2"], // ignored
  };

  const result = runPostGuard(env);

  expect(result.ok).toBeTruthy();
  if (result.ok) {
    expect(result.data.mode).toBe("FULL");

    expect(artifactIds(result.data.effects.eligible.artifacts)).toEqual([
      "note_1",
      "report_1",
    ]);

    expect(result.data.rulesApplied).toContain(
      "FULL_COMMIT_ALL_PROVISIONAL_EFFECTS",
    );

    expect(result.data.rulesApplied).toContain("FULL_IGNORES_ALLOWLIST");
  }
});
