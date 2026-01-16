import type { IngestionPipelineEnvelope } from "#/types/rna/pipeline/ingestion/ingestion.types";

// function deepMerge<T>(base: T, patch: Partial<T>): T {
//   if (patch === null || patch === undefined) return base;
//   if (typeof base !== "object" || base === null) return patch as T;
//   if (typeof patch !== "object" || patch === null) return patch as T;

//   if (Array.isArray(base) || Array.isArray(patch)) return patch as T;

//   const out: any = { ...(base as any) };
//   for (const [k, v] of Object.entries(patch as any)) {
//     out[k] = k in out ? deepMerge(out[k], v) : v;
//   }
//   return out;
// }

type EnvelopePatch = {
  ids?: Partial<IngestionPipelineEnvelope["ids"]>;
  stages?: Partial<IngestionPipelineEnvelope["stages"]>;
  errors?: IngestionPipelineEnvelope["errors"];
  meta?: Partial<NonNullable<IngestionPipelineEnvelope["meta"]>>;
};

export function makeEnv(patch: EnvelopePatch = {}): IngestionPipelineEnvelope {
  const now = Date.now();

  const base: IngestionPipelineEnvelope = {
    ids: {
      proposalId: "proposal_1",
      snapshotId: "snap_1",
      effectsLogId: "effects_1",
    },
    stages: {
      intake: { hasRun: false },

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
        executionPlanId: "plan_1",
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
