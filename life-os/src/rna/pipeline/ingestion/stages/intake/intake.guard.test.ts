import { test, expect } from "vitest";

import { guardIntake } from "#/rna/pipeline/ingestion/stages/intake/intake.guard";
import { makeEnv, clearDefaultIdsPastStage } from "#/shared/test-utils";

test("returns ok:false INVALID_INTAKE_INPUT when input shape is wrong", () => {
  const result = guardIntake({ nope: true } as any);

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.code).toBe("INVALID_INTAKE_INPUT");
    expect(result.stage).toBe("INTAKE");
    expect(typeof result.message).toBe("string");
    expect(result.trace).toBeTruthy();
    expect(result.trace.mode).toBe("UNKNOWN");
    expect(result.trace.rulesApplied).toBeInstanceOf(Array);
    expect(result.trace.rulesApplied).toContain("PARSE_FAILED");
  }
});

test("returns ok:false INVALID_INTAKE_INPUT when proposalId missing", () => {
  const env = makeEnv();
  clearDefaultIdsPastStage("intake", env);

  const result = guardIntake(env as any);

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.code).toBe("INVALID_INTAKE_INPUT");
    expect(result.stage).toBe("INTAKE");
    expect(result.trace.rulesApplied).toContain("PARSE_FAILED");
  }
});

test("returns ok:false INVALID_INTAKE_INPUT when RAW_PROPOSAL missing required fields", () => {
  const env = makeEnv();

  // Intake input is not yet locked in code; we assert contract intent:
  // RAW_PROPOSAL must exist and contain required structural keys.
  // Keep this as a "shape enforcement" test for your IntakeInputSchema/pluckParams.
  (env as any).rawProposal = {
    // missing required fields like INTENT / ACTOR / TARGET_ENTITY / TARGET_SCOPE etc.
  };

  const result = guardIntake(env as any);

  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.code).toBe("INVALID_INTAKE_INPUT");
    expect(result.stage).toBe("INTAKE");
    expect(result.trace.rulesApplied).toContain("PARSE_FAILED");
  }
});

test("returns ok:true when minimal structural RAW_PROPOSAL is present (no semantic judgment)", () => {
  const env = makeEnv();

  // Minimal structural shape per contract:
  // Intake does not judge semantics; it only requires structurally normalizable input.
  (env as any).rawProposal = {
    intent: "Start weekly reflection workflow",
    actor: { actorId: "user_1", actorType: "USER" },
    target: {
      entity: "REFLECTION",
      scope: { allowedKinds: ["NOTE"] },
    },
    dependencies: [],
    impact: "LOW",
    reversibilityClaim: "REVERSIBLE",
  };

  const result = guardIntake(env as any);

  expect(result.ok).toBeTruthy();

  if (result.ok) {
    // We don't assert full normalization here; that's stage responsibility.
    // Guard should at least pass through the candidate/projection used by the schema.
    expect(typeof (result.data as any).rawProposal.actor.actorId).toBe(
      "string",
    );
  }
});
