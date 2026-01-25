import assert from "node:assert";

import type {
  IngestionContextSnapshot,
  IngestionPipelineEnvelope,
} from "#/rna/pipeline/ingestion/ingestion.types";
import { IntakeRawProposal } from "#/rna/pipeline/ingestion/intake/intake.types";

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

const clearDataPerStage = {
  intake: {
    ids: [
      "intakeId",
      "validationId",
      "planningId",
      "executionId",
      "revalidationId",
      "commitId",
      "proposalId",
      "snapshotId",
      "effectsLogId",
    ],
    stages: [
      "intake",
      "validation",
      "planning",
      "execution",
      "revalidation",
      "commit",
    ],
  },
  validation: {
    ids: [
      "validationId",
      "planningId",
      "executionId",
      "revalidationId",
      "commitId",
    ],
    stages: ["validation", "planning", "execution", "revalidation", "commit"],
  },
  planning: {
    ids: ["planningId", "executionId", "revalidationId", "commitId"],
    stages: ["planning", "execution", "revalidation", "commit"],
  },
  execution: {
    ids: ["executionId", "revalidationId", "commitId", "effectsLogId"],
    stages: ["execution", "revalidation", "commit"],
  },
  revalidation: {
    ids: ["revalidationId", "commitId"],
    stages: ["revalidation", "commit"],
  },
  commit: {
    ids: ["commitId"],
    stages: ["commit"],
  },
};

export function clearDefaultIdsPastStage(
  stage: string,
  env: IngestionPipelineEnvelope
) {
  if (stage === "intake") clearIds(env, clearDataPerStage[stage].ids);
  if (stage === "validation") clearIds(env, idsToClear.slice(1));
  if (stage === "planning") clearIds(env, idsToClear.slice(2));
  if (stage === "execution") clearIds(env, idsToClear.slice(3));
  if (stage === "revalidation") clearIds(env, idsToClear.slice(5));
  if (stage === "commit") clearIds(env, idsToClear.slice(6));
}

export function clearIds(env: IngestionPipelineEnvelope, ids: Array<string>) {
  for (let id of ids) {
    if ((env.ids as any)[id]) (env.ids as any)[id] = undefined;
  }
}

function clearStages(env: IngestionPipelineEnvelope, stages: Array<string>) {
  for (let stage of stages) {
    if ((env.stages as any)[stage])
      (env.stages as any)[stage] = { hasRun: false };
  }
}

export function resetStagesUpTo(stage: string, env: IngestionPipelineEnvelope) {
  if (stage === "intake") {
    clearIds(env, clearDataPerStage[stage].ids);
    clearStages(env, clearDataPerStage[stage].stages);
  }

  if (stage === "validation") clearIds(env, idsToClear.slice(1));
  if (stage === "planning") clearIds(env, idsToClear.slice(2));
  if (stage === "execution") clearIds(env, idsToClear.slice(3));
  if (stage === "revalidation") clearIds(env, idsToClear.slice(5));
  if (stage === "commit") clearIds(env, idsToClear.slice(6));

  return env;
}

export function assertMatchId(id: string, prefix: string) {
  return assert.match(id, new RegExp(`^${prefix}[0-9a-f\\-]+$`));
}

export function makeEnv(patch: EnvelopePatch = {}): IngestionPipelineEnvelope {
  const now = Date.now();

  const base: IngestionPipelineEnvelope = {
    ids: {
      intakeId: "intake_1",
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
        intakeId: "intake_1",
        proposalId: "proposal_1",
        commitPolicy: { allowedModes: ["FULL"] as const },
      },

      // ✅ validation hasRun true by default + commitPolicy lives here
      validation: {
        hasRun: true,
        ranAt: now,
        observed: { intakeId: "intake_1", proposalId: "proposal_1" } as any,
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
    permissions: {
      actor: { actorId: "user_1", actorType: "USER" },
      allow: ["WEEKLY_REFLECTION"] as const,
    },
    invariantsVersion: "v1",
    scope: { allowedKinds: ["NOTE"] as const },
    timestampMs: 0,
    dependencyVersions: {},
  } satisfies IngestionContextSnapshot;
}

export function makeRawProposalSchema() {
  return {
    intent: "Start weekly reflection workflow",
    actor: { actorId: "user_1", actorType: "USER" },
    target: {
      entity: "REFLECTION",
      scope: { allowedKinds: ["NOTE"] as const },
    },
    dependencies: ["calendar"],
    impact: "LOW",
    reversibilityClaim: "REVERSIBLE",
  } satisfies IntakeRawProposal;
}
