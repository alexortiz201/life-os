import * as E from "fp-ts/Either";
import assert from "node:assert/strict";

import type {
  IngestionContextSnapshot,
  IngestionPipelineEnvelope,
} from "#/rna/pipeline/ingestion/ingestion.types";
import { IntakeRawProposal } from "#/rna/pipeline/ingestion/stages/intake/intake.types";

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
      "proposalId",
      "snapshotId",
      "planningId",
      "executionId",
      "effectsLogId",
      "revalidationId",
      "commitId",
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
      "effectsLogId",
      "revalidationId",
      "commitId",
    ],
    stages: ["validation", "planning", "execution", "revalidation", "commit"],
  },
  planning: {
    ids: [
      "planningId",
      "executionId",
      "effectsLogId",
      "revalidationId",
      "commitId",
    ],
    stages: ["planning", "execution", "revalidation", "commit"],
  },
  execution: {
    ids: ["executionId", "effectsLogId", "revalidationId", "commitId"],
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
  stage: keyof typeof clearDataPerStage,
  env: IngestionPipelineEnvelope,
) {
  if (clearDataPerStage[stage]) clearIds(env, clearDataPerStage[stage].ids);

  return env;
}

export function clearIds(env: IngestionPipelineEnvelope, ids: Array<string>) {
  for (let id of ids) {
    if ((env.ids as any)[id]) (env.ids as any)[id] = undefined;
  }

  return env;
}

function clearStages(env: IngestionPipelineEnvelope, stages: Array<string>) {
  for (let stage of stages) {
    if ((env.stages as any)[stage])
      (env.stages as any)[stage] = { hasRun: false };
  }

  return env;
}

export function resetStagesUpTo(
  stage: keyof typeof clearDataPerStage,
  env: IngestionPipelineEnvelope,
) {
  if (clearDataPerStage[stage]) {
    clearIds(env, clearDataPerStage[stage].ids);
    clearStages(env, clearDataPerStage[stage].stages);
  }

  return env;
}

export function assertMatchId(id: string, prefix: string) {
  return assert.match(id, new RegExp(`^${prefix}[0-9a-f\\-]+$`));
}

function makeIds() {
  return {
    intakeId: "intake_1",
    planningId: "planning_1",
    validationId: "validation_1",
    proposalId: "proposal_1",
    snapshotId: "snap_1",
    executionId: "exec_1",
    effectsLogId: "effects_1",
  };
}

export function makeEnv(patch: EnvelopePatch = {}): IngestionPipelineEnvelope {
  const now = Date.now();
  const base: IngestionPipelineEnvelope = {
    ids: { ...makeIds() },
    snapshot: { ...makeSnapshot() },
    stages: {
      intake: {
        hasRun: true,
        ranAt: now,
        observed: {} as any,
        intakeId: "intake_1",
        commitPolicy: { allowedModes: ["FULL"] as const },
        proposal: {
          id: "proposal_1",
          createdAt: `${now}`,
          actor: "USER",
          kind: "WEEKLY_REFLECTION",
          trust: "UNTRUSTED",
          proposalId: "proposal_1",
          fingerprint: "testHash12093812093",
          intakeTimestamp: `${now}`,
          rawProposal: "",
        },
      },

      // ✅ validation hasRun true by default + commitPolicy lives here
      validation: {
        hasRun: true,
        ranAt: now,
        observed: { intakeId: "intake_1", proposalId: "proposal_1" } as any,
        validationId: "validation_1",
        snapshotId: "snap_1",
        commitPolicy: { allowedModes: ["FULL"] as const },
      } as any,

      planning: {
        hasRun: true,
        ranAt: now,
        observed: {
          proposalId: "proposal_1",
          validationId: "validation_1",
          snapshotId: "snap_1",
        } as any,
        planningId: "planning_1",
        plan: [
          {
            stepId: "step_1",
            kind: "PRODUCE_ARTIFACT",
            description: "Produce a NOTE artifact for weekly reflection.",
            outputs: {
              artifacts: [{ kind: "NOTE" }],
              events: [],
            },
          },
          {
            stepId: "step_2",
            kind: "EMIT_EVENT",
            description:
              "Emit an event indicating reflection is ready for review.",
            outputs: {
              artifacts: [],
              events: [{ name: "REFLECTION_READY" }],
            },
          },
        ],
        fingerprint: "testHash12093812093",
      } as any,

      // ✅ execution hasRun true by default
      // put the fields revalidation.guard expects to pluck/parse
      execution: {
        hasRun: true,
        ranAt: now,
        observed: {
          proposalId: "proposal_1",
          planningId: "planning_1",
          snapshotId: "snap_1",
        } as any,
        executionId: "exec_1",
        proposalId: "proposal_1",
        snapshotId: "snap_1",
        validationDecision: "validation_decision_1",
        executionPlanningId: "plan_1",
        executionPlan: ["step_1"],
        executionResult: ["ok"],
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
          ],
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
  patch: EnvelopePatch = {},
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

export function lastError(env: IngestionPipelineEnvelope) {
  return env.errors[env.errors.length - 1];
}

export function unwrapRight<L, R>(either: E.Either<L, R>): R {
  assert.ok(E.isRight(either), "expected Right");
  return either.right;
}

export function unwrapLeft<L, R>(either: E.Either<L, R>): L {
  assert.ok(E.isLeft(either), "expected Left");
  return either.left;
}

export function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}
