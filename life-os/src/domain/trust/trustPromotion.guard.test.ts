import { test, describe, it, expect } from "vitest";
import { guardTrustPromotion } from "#/domain/trust/trustPromotion.guard";

test("rejects promotion to COMMITTED outside COMMIT stage", () => {
  const result = guardTrustPromotion({
    from: "PROVISIONAL",
    to: "COMMITTED",
    stage: "EXECUTION",
    reason: "attempted commit early",
  });

  expect(result.ok).toBeFalsy();
  if (!result.ok) expect(result.code).toBe("COMMIT_STAGE_REQUIRED");
});

test("allows promotion to COMMITTED at COMMIT stage", () => {
  const result = guardTrustPromotion({
    from: "PROVISIONAL",
    to: "COMMITTED",
    stage: "COMMIT",
    reason: "commit record exists",
  });

  expect(result.ok).toBeTruthy();
});

test("rejects trust downgrade", () => {
  const result = guardTrustPromotion({
    from: "COMMITTED",
    to: "PROVISIONAL",
    stage: "COMMIT",
    reason: "should not downgrade via promotion",
  });

  expect(result.ok).toBeFalsy();
  if (!result.ok) expect(result.code).toBe("TRUST_DOWNGRADE_FORBIDDEN");
});

/* test("rejects DERIVED unless source is COMMITTED", () => {
  const result = guardTrustPromotion({
    from: "PROVISIONAL",
    to: "DERIVED",
    stage: "DERIVATION",
    reason: "attempted to derive from provisional",
  });

  expect(result.ok).toBeFalsy();
  if (!result.ok) expect(result.code).toBe("DERIVATION_REQUIRES_COMMITTED");
});

test("rejects DERIVED unless stage is DERIVATION", () => {
  const result = guardTrustPromotion({
    from: "COMMITTED",
    to: "DERIVED",
    stage: "COMMIT",
    reason: "attempted to derive from committed",
  });

  expect(result.ok).toBeFalsy();
  if (!result.ok)
    expect(result.code).toBe("DERIVATION_REQUIRES_STAGE_DERIVATION");
});

test("allows promotion to DERIVED at DERIVATION stage", () => {
  const result = guardTrustPromotion({
    from: "COMMITTED",
    to: "DERIVED",
    stage: "DERIVATION",
    reason: "attempted to derive from committed",
  });

  expect(result.ok).toBeTruthy();
}); */

test("rejects invalid request shape", () => {
  const result = guardTrustPromotion({
    from: "PROVISIONAL",
    to: "COMMITTED",
    stage: "COMMIT",
    reason: "",
  });

  expect(result.ok).toBeFalsy();
  if (!result.ok) expect(result.code).toBe("INVALID_REQUEST");
});
