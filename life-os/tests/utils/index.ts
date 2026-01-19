import { ContextSnapshot } from "#/types/domain/snapshot/snapshot.provider.types";
import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";

type EnvelopePatch = {
  ids?: Partial<IngestionPipelineEnvelope["ids"]>;
  stages?: Partial<IngestionPipelineEnvelope["stages"]>;
  errors?: IngestionPipelineEnvelope["errors"];
  meta?: Partial<NonNullable<IngestionPipelineEnvelope["meta"]>>;
};

const idsToClear = [
  "intakeId",
  "validationId",
  "planningId",
  "executionId",
  "effectsLogId",
  "revalidationId",
  "commitId",
];

export function clearDefaultIdsPastStage(
  stage: string,
  env: IngestionPipelineEnvelope
) {
  if (stage === "validation") deleteIds(env, idsToClear.slice(1));
  if (stage === "planning") deleteIds(env, idsToClear.slice(2));
  if (stage === "execution") deleteIds(env, idsToClear.slice(3));
  if (stage === "revalidation") deleteIds(env, idsToClear.slice(5));
  if (stage === "commit") deleteIds(env, idsToClear.slice(6));
}

export function deleteIds(env: IngestionPipelineEnvelope, ids: Array<string>) {
  for (let id of ids) {
    if ((env.ids as any)[id]) delete (env.ids as any)[id];
  }
}

export function makeEnv(patch: EnvelopePatch = {}): IngestionPipelineEnvelope {
  const now = Date.now();

  const base: IngestionPipelineEnvelope = {
    ids: {
      validationId: "validation_1",
      proposalId: "proposal_1",
      snapshotId: "snap_1",
      effectsLogId: "effects_1",
    },
    snapshot: { ...makeSnapshot() },
    stages: {
      intake: {
        hasRun: true,
        ranAt: now,
        observed: {} as any,
        proposalId: "proposal_1",
        commitPolicy: { allowedModes: ["FULL"] as const },
      },

      // ✅ validation hasRun true by default + commitPolicy lives here
      validation: {
        hasRun: true,
        ranAt: now,
        observed: { proposalId: "proposal_1" } as any,
        validationId: "validation_1",
        commitPolicy: { allowedModes: ["FULL"] as const },
      } as any,

      planning: { hasRun: false },

      // ✅ execution hasRun true by default
      // put the fields revalidation.guard expects to pluck/parse
      execution: {
        hasRun: true,
        ranAt: now,
        observed: { proposalId: "proposal_1", snapshotId: "snap_1" } as any,
        executionId: "exec_1",
        proposalId: "proposal_1",
        snapshotId: "snap_1",
        validationDecision: "validation_decision_1",
        executionplanningId: "plan_1",
        executionPlan: ["step_1"],
        executionResult: ["ok"],
        effectsLog: {
          effectsLogId: "effects_1",
          proposalId: "proposal_1",
          producedEffects: [],
        },
      } as any,

      revalidation: { hasRun: false },
      commit: { hasRun: false },
    } as any,
    errors: [],
  };

  return {
    ...base,
    ...patch,
    ids: { ...base.ids, ...(patch.ids ?? {}) },
    stages: { ...base.stages, ...(patch.stages ?? {}) },
    errors: patch.errors ?? base.errors,
  };
}

export function makeCommitEnv(
  patch: EnvelopePatch = {}
): IngestionPipelineEnvelope {
  const now = Date.now();

  const base: IngestionPipelineEnvelope = {
    ids: {
      proposalId: "proposal_1",
      snapshotId: "snap_1",
      effectsLogId: "effects_1",
      revalidationId: "revalidation_1",
    },
    snapshot: { ...makeSnapshot() },
    stages: {
      intake: { hasRun: false },
      validation: {
        hasRun: true,
        ranAt: now,
        observed: { proposalId: "proposal_1" } as any,
        validationId: "validation_1",
        commitPolicy: { allowedModes: ["FULL"] },
      } as any,
      planning: { hasRun: false },
      execution: {
        hasRun: true,
        ranAt: now,
        observed: { proposalId: "proposal_1", snapshotId: "snap_1" } as any,
        executionId: "exec_1",
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
      } as any,
      revalidation: {
        hasRun: true,
        ranAt: now,
        observed: {
          proposalId: "proposal_1",
          snapshotId: "snap_1",
          effectsLogId: "effects_1",
        } as any,
        revalidationId: "revalidation_1",
        proposalId: "proposal_1",
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
          ],
        },
        directive: {
          proposalId: "proposal_1",
          outcome: "APPROVE_COMMIT",
          commitAllowList: [],
          rulesApplied: [],
        },
      } as any,
      commit: { hasRun: false },
    } as any,
    errors: [],
    meta: {},
  };

  const merged: IngestionPipelineEnvelope = {
    ...base,
    ids: { ...base.ids, ...(patch.ids ?? {}) },
    stages: {
      ...base.stages,
      ...(patch.stages ?? {}),

      // ✅ deep-merge the ones you’ll patch often
      execution: {
        ...(base.stages.execution as any),
        ...((patch.stages?.execution as any) ?? {}),
      },
      revalidation: {
        ...(base.stages.revalidation as any),
        ...((patch.stages?.revalidation as any) ?? {}),
        // if you patch nested pieces like directive/effectsLog, keep them too
        directive: {
          ...(base.stages.revalidation as any).directive,
          ...((patch.stages?.revalidation as any)?.directive ?? {}),
        },
        effectsLog: {
          ...(base.stages.revalidation as any).effectsLog,
          ...((patch.stages?.revalidation as any)?.effectsLog ?? {}),
        },
      },
    },
    errors: patch.errors ?? base.errors,
    meta: { ...(base.meta as any), ...(patch.meta ?? {}) },
  };

  return merged;
}

export function makeSnapshot() {
  return {
    permissions: { actor: "user_1", allow: ["WEEKLY_REFLECTION"] as const },
    invariantsVersion: "v1",
    scope: { allowedKinds: ["NOTE"] as const },
    timestampMs: 0,
    dependencyVersions: {},
  } satisfies ContextSnapshot<"WEEKLY_REFLECTION", "NOTE">;
}
