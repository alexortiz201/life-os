import test from "node:test";
import assert from "node:assert/strict";

import { guardIntake } from "#/rna/pipeline/ingestion/stages/intake/intake.guard";
import { makeEnv, clearDefaultIdsPastStage } from "#/shared/test-utils";

// test("returns ok:false INVALID_INTAKE_INPUT when input shape is wrong", () => {
//   const result = guardIntake({ nope: true } as any);

//   assert.equal(result.ok, false);
//   if (!result.ok) {
//     assert.equal(result.code, "INVALID_INTAKE_INPUT");
//     assert.equal(result.stage, "INTAKE");
//     assert.equal(typeof result.message, "string");
//     assert.ok(result.trace);
//     assert.equal(result.trace.mode, "UNKNOWN");
//     assert.ok(Array.isArray(result.trace.rulesApplied));
//     assert.ok(result.trace.rulesApplied.includes("PARSE_FAILED"));
//   }
// });

// test("returns ok:false INVALID_INTAKE_INPUT when proposalId missing", () => {
//   const env = makeEnv();
//   clearDefaultIdsPastStage("intake", env);

//   const result = guardIntake(env as any);

//   assert.equal(result.ok, false);
//   if (!result.ok) {
//     assert.equal(result.code, "INVALID_INTAKE_INPUT");
//     assert.equal(result.stage, "INTAKE");
//     assert.ok(result.trace.rulesApplied.includes("PARSE_FAILED"));
//   }
// });

// test("returns ok:false INVALID_INTAKE_INPUT when RAW_PROPOSAL missing required fields", () => {
//   const env = makeEnv();

//   // Intake input is not yet locked in code; we assert contract intent:
//   // RAW_PROPOSAL must exist and contain required structural keys.
//   // Keep this as a "shape enforcement" test for your IntakeInputSchema/pluckParams.
//   (env as any).rawProposal = {
//     // missing required fields like INTENT / ACTOR / TARGET_ENTITY / TARGET_SCOPE etc.
//   };

//   const result = guardIntake(env as any);

//   assert.equal(result.ok, false);
//   if (!result.ok) {
//     assert.equal(result.code, "INVALID_INTAKE_INPUT");
//     assert.equal(result.stage, "INTAKE");
//     assert.ok(result.trace.rulesApplied.includes("PARSE_FAILED"));
//   }
// });

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

  assert.equal(result.ok, true);

  if (result.ok) {
    // We don't assert full normalization here; that's stage responsibility.
    // Guard should at least pass through the candidate/projection used by the schema.
    assert.equal(
      typeof (result.data as any).rawProposal.actor.actorId,
      "string",
    );
  }
});
