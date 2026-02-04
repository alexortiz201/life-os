import test from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import {
  // BaseOutboxEntrySchema,
  OutboxEntryOpaqueSchema,
  makeOutboxEntrySchema,
} from "#/platform/outbox/outbox.schemas";

function baseEntry(
  overrides: Partial<z.infer<typeof OutboxEntryOpaqueSchema>> = {},
) {
  const now = Date.now();
  return {
    outboxId: "outbox_1",
    idempotencyKey: "idem_1",
    pipeline: "INGESTION",
    stage: "COMMIT",
    status: "PENDING",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    effect: { anything: true },
    ...overrides,
  };
}

test("BaseOutboxEntrySchema: rejects FAILED without error", () => {
  const candidate = baseEntry({ status: "FAILED", error: undefined });
  const res = OutboxEntryOpaqueSchema.safeParse(candidate);

  assert.equal(res.success, false);
  if (!res.success) {
    // should point at error
    const paths = res.error.issues.map((i) => i.path.join("."));
    assert.ok(paths.includes("error"));
  }
});

test("BaseOutboxEntrySchema: rejects error when status != FAILED", () => {
  const candidate = baseEntry({
    status: "PENDING",
    error: { message: "nope", at: Date.now() },
  });
  const res = OutboxEntryOpaqueSchema.safeParse(candidate);

  assert.equal(res.success, false);
  if (!res.success) {
    const paths = res.error.issues.map((i) => i.path.join("."));
    assert.ok(paths.includes("error"));
  }
});

test("BaseOutboxEntrySchema: strict() rejects unknown keys", () => {
  const candidate = { ...baseEntry(), extra: "nope" } as any;
  const res = OutboxEntryOpaqueSchema.safeParse(candidate);

  assert.equal(res.success, false);
});

test("attempts defaults to 0 when omitted", () => {
  const now = Date.now();
  const candidate: any = {
    outboxId: "outbox_1",
    idempotencyKey: "idem_1",
    pipeline: "INGESTION",
    stage: "COMMIT",
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
    effect: { anything: true },
  };

  const res = OutboxEntryOpaqueSchema.safeParse(candidate);
  assert.equal(res.success, true);
  if (res.success) {
    assert.equal(res.data.attempts, 0);
  }
});

test("makeOutboxEntrySchema: can constrain pipeline/stage to literals", () => {
  const EffectSchema = z.object({ kind: z.literal("NOTE") });

  const Schema = makeOutboxEntrySchema({
    effect: EffectSchema,
    pipeline: z.literal("INGESTION"),
    stage: z.literal("COMMIT"),
  });

  // valid
  const ok = Schema.safeParse(
    baseEntry({
      pipeline: "INGESTION",
      stage: "COMMIT",
      effect: { kind: "NOTE" },
    }) as any,
  );
  assert.equal(ok.success, true);

  // invalid stage
  const bad = Schema.safeParse(
    baseEntry({
      pipeline: "INGESTION",
      stage: "PLANNING" as any,
      effect: { kind: "NOTE" },
    }) as any,
  );
  assert.equal(bad.success, false);
});

test("makeOutboxEntrySchema: enforces provided effect schema", () => {
  const EffectSchema = z.object({ kind: z.literal("NOTE") });
  const Schema = makeOutboxEntrySchema({ effect: EffectSchema });

  const bad = Schema.safeParse(
    baseEntry({ effect: { kind: "REPORT" } }) as any,
  );
  assert.equal(bad.success, false);
});
