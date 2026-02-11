import * as E from "fp-ts/Either";
import assert from "node:assert/strict";

import type {
  IngestionContextSnapshot,
  IngestionPipelineEnvelope,
  IngestionStages,
} from "#/rna/pipeline/ingestion/ingestion.types";
import { IntakeRawProposal } from "#/rna/pipeline/ingestion/stages/intake/intake.types";
import { fingerprint } from "#/domain/encoding/fingerprint";

type EnvelopePatch = {
  ids?: Partial<IngestionPipelineEnvelope["ids"]>;
  stages?: Partial<IngestionPipelineEnvelope["stages"]>;
  errors?: IngestionPipelineEnvelope["errors"];
  meta?: Partial<NonNullable<IngestionPipelineEnvelope["meta"]>>;
};

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
    proposalId: "proposal_1",
    intakeId: "intake_1",
    validationId: "validation_1",
    planningId: "planning_1",
    executionId: "exec_1",
    snapshotId: "snap_1",
    effectsLogId: "effects_1",
    revalidationId: "revalidation_1",
  };
}

export function makeValidEffectsLog(params?: {
  proposalId?: string;
  producedEffects?: any[];
  effectsLogId?: string;
  fingerprint?: string;
}) {
  const effectsLogId = params?.effectsLogId ?? "effects_1";
  const proposalId = params?.proposalId ?? "proposal_1";
  const producedEffects = params?.producedEffects ?? [];

  const fp =
    params?.fingerprint ??
    fingerprint({
      proposalId,
      effectsLogId,
      producedEffects,
    });

  return {
    effectsLogId,
    proposalId,
    producedEffects,
    fingerprint: fp,
  };
}

export function makeEnv(patch: EnvelopePatch = {}): IngestionPipelineEnvelope {
  const now = Date.now();
  const snapshot = { ...makeSnapshot() };
  const base: IngestionPipelineEnvelope = {
    ids: { ...makeIds() },
    snapshot,
    stages: {
      intake: {
        hasRun: true as const,
        ranAt: now,
        observed: {} as any,
        intakeId: "intake_1",
        proposal: {
          id: "proposal_1",
          createdAt: `${now}`,
          actor: { actorId: "user_123", actorType: "USER" as const },
          kind: "PROPOSAL_RECORD",
          trust: "UNTRUSTED",
          proposalId: "proposal_1",
          fingerprint: "fingerprintHash@proposal",
          intakeTimestamp: `${now}`,
          rawProposal: "",
        },
      } satisfies IngestionStages["intake"],

      // ✅ validation hasRun true by default + commitPolicy lives here
      validation: {
        hasRun: true,
        ranAt: now,
        observed: { intakeId: "intake_1", proposalId: "proposal_1" } as any,
        validationId: "validation_1",
        decisionType: "APPROVE",
        decidedAt: now,
        justification: true,
        attribution: [],
        commitPolicy: { allowedModes: ["FULL"] as const },
        fingerprint: "fingerprintHash@validation",
        snapshot: {
          snapshotId: "snap_1",
          ...snapshot,
        },
      } satisfies IngestionStages["validation"],

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
        fingerprint: "fingerprintHash@planning",
      } satisfies IngestionStages["planning"],

      // ✅ execution hasRun true by default
      // put the fields revalidation.guard expects to pluck/parse
      execution: {
        hasRun: true,
        ranAt: now,
        observed: {
          proposalId: "proposal_1",
          planningId: "planning_1",
          snapshotId: "snap_1",
        },
        executionId: "exec_1",
        effectsLog: {
          ...makeValidEffectsLog({
            effectsLogId: "effects_1",
            proposalId: "proposal_1",
            producedEffects: [
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
                objectId: "report_1",
                kind: "REPORT",
                trust: "PROVISIONAL",
              },
            ],
          }),
        },
      } satisfies IngestionStages["execution"],
      revalidation: {
        hasRun: true,
        ranAt: now,
        observed: {
          proposalId: "proposal_1",
          snapshotId: "snap_1",
          effectsLogId: "effects_1",
          executionId: "exec_1",
          validationId: "validation_1",
        },
        revalidationId: "revalidation_1",
        proposalId: "proposal_1",
        directive: {
          proposalId: "proposal_1",
          outcome: "APPROVE_COMMIT" as const,
          commitAllowList: [],
          rulesApplied: [],
        },
      } satisfies IngestionStages["revalidation"],
      commit: { hasRun: false } satisfies IngestionStages["commit"],
    } as any,
    errors: [],
  };

  return {
    ...base,
    ...patch,
    ids: { ...base.ids, ...(patch.ids ?? {}) },
    stages: { ...base.stages, ...(patch.stages ?? {}) },
    errors: patch.errors ?? base.errors,
    meta: { ...(base.meta as any), ...(patch.meta ?? {}) },
  };
}

export function makeSnapshot() {
  return {
    permissions: {
      actor: { actorId: "user_1", actorType: "USER" as const },
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
