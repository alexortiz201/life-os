import { test, describe, it, expect } from "vitest";

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

  expect(res.success).toBeFalsy();
  if (!res.success) {
    // should point at error
    const paths = res.error.issues.map((i) => i.path.join("."));
    expect(paths).toContain("error");
  }
});

test("BaseOutboxEntrySchema: rejects error when status != FAILED", () => {
  const candidate = baseEntry({
    status: "PENDING",
    error: { message: "nope", at: Date.now() },
  });
  const res = OutboxEntryOpaqueSchema.safeParse(candidate);

  expect(res.success).toBeFalsy();
  if (!res.success) {
    const paths = res.error.issues.map((i) => i.path.join("."));
    expect(paths).toContain("error");
  }
});

test("BaseOutboxEntrySchema: strict() rejects unknown keys", () => {
  const candidate = { ...baseEntry(), extra: "nope" } as any;
  const res = OutboxEntryOpaqueSchema.safeParse(candidate);

  expect(res.success).toBeFalsy();
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
  expect(res.success).toBeTruthy();
  if (res.success) {
    expect(res.data.attempts).toBe(0);
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
  expect(ok.success).toBeTruthy();

  // invalid stage
  const bad = Schema.safeParse(
    baseEntry({
      pipeline: "INGESTION",
      stage: "PLANNING" as any,
      effect: { kind: "NOTE" },
    }) as any,
  );
  expect(bad.success).toBeFalsy();
});

test("makeOutboxEntrySchema: enforces provided effect schema", () => {
  const EffectSchema = z.object({ kind: z.literal("NOTE") });
  const Schema = makeOutboxEntrySchema({ effect: EffectSchema });

  const bad = Schema.safeParse(
    baseEntry({ effect: { kind: "REPORT" } }) as any,
  );
  expect(bad.success).toBeFalsy();
});
