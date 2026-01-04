import test from "node:test";
import assert from "node:assert/strict";
import { guardTrustPromotion } from "#/domain/trust/trustPromotion.guard";

test("rejects promotion to COMMITTED outside COMMIT stage", () => {
  const result = guardTrustPromotion({
    from: "PROVISIONAL",
    to: "COMMITTED",
    stage: "EXECUTION",
    reason: "attempted commit early",
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "COMMIT_STAGE_REQUIRED");
});

test("allows promotion to COMMITTED at COMMIT stage", () => {
  const result = guardTrustPromotion({
    from: "PROVISIONAL",
    to: "COMMITTED",
    stage: "COMMIT",
    reason: "commit record exists",
  });

  assert.equal(result.ok, true);
});

test("rejects trust downgrade", () => {
  const result = guardTrustPromotion({
    from: "COMMITTED",
    to: "PROVISIONAL",
    stage: "COMMIT",
    reason: "should not downgrade via promotion",
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "TRUST_DOWNGRADE_FORBIDDEN");
});

/* test("rejects DERIVED unless source is COMMITTED", () => {
  const result = guardTrustPromotion({
    from: "PROVISIONAL",
    to: "DERIVED",
    stage: "DERIVATION",
    reason: "attempted to derive from provisional",
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "DERIVATION_REQUIRES_COMMITTED");
});

test("rejects DERIVED unless stage is DERIVATION", () => {
  const result = guardTrustPromotion({
    from: "COMMITTED",
    to: "DERIVED",
    stage: "COMMIT",
    reason: "attempted to derive from committed",
  });

  assert.equal(result.ok, false);
  if (!result.ok)
    assert.equal(result.code, "DERIVATION_REQUIRES_STAGE_DERIVATION");
});

test("allows promotion to DERIVED at DERIVATION stage", () => {
  const result = guardTrustPromotion({
    from: "COMMITTED",
    to: "DERIVED",
    stage: "DERIVATION",
    reason: "attempted to derive from committed",
  });

  assert.equal(result.ok, true);
}); */

test("rejects invalid request shape", () => {
  const result = guardTrustPromotion({
    from: "PROVISIONAL",
    to: "COMMITTED",
    stage: "COMMIT",
    reason: "",
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "INVALID_REQUEST");
});
