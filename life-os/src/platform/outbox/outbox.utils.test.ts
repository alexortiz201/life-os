import test from "node:test";
import assert from "node:assert/strict";

import { OutboxEntryOpaqueSchema } from "#/platform/outbox/outbox.schemas";
import type { OutboxEntryOpaque } from "#/platform/outbox/outbox.types";

import {
  canRetry,
  markOutboxApplied,
  markOutboxFailed,
  markOutboxInProgress,
  markOutboxPending,
} from "#/platform/outbox/outbox.utils";

function makeEntry(
  overrides: Partial<OutboxEntryOpaque> = {},
): OutboxEntryOpaque {
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
  } as OutboxEntryOpaque;
}

function assertSchemaValid(entry: OutboxEntryOpaque) {
  const res = OutboxEntryOpaqueSchema.safeParse(entry);
  assert.equal(res.success, true);
  if (!res.success) {
    // helpful if it ever fails
    assert.fail(JSON.stringify((res as any).error.issues, null, 2));
  }
}

test("markOutboxInProgress: sets status, clears error, updates updatedAt", () => {
  const e0 = makeEntry({
    status: "FAILED",
    error: { message: "x", at: Date.now() },
    lastError: { message: "x", at: Date.now() },
  } as any);

  const e1 = markOutboxInProgress(e0, { updatedAt: 123 });
  assert.equal(e1.status, "IN_PROGRESS");
  assert.equal(e1.updatedAt, 123);
  assert.equal(e1.error, undefined);

  assertSchemaValid(e1);
});

test("markOutboxApplied: sets APPLIED + appliedAt + clears error/lastError", () => {
  const e0 = makeEntry({
    status: "FAILED",
    error: { message: "x", at: Date.now() },
    lastError: { message: "x", at: Date.now() },
  } as any);

  const e1 = markOutboxApplied(e0, { appliedAt: 456 });
  assert.equal(e1.status, "APPLIED");
  assert.equal(e1.appliedAt, 456);
  assert.equal(e1.updatedAt, 456);
  assert.equal(e1.error, undefined);
  assert.equal(e1.lastError, undefined);

  assertSchemaValid(e1);
});

test("markOutboxFailed: sets FAILED + increments attempts + sets error + lastError", () => {
  const e0 = makeEntry({ status: "IN_PROGRESS", attempts: 1 });
  const err = { message: "boom", at: 999 };

  const e1 = markOutboxFailed(e0, err);
  assert.equal(e1.status, "FAILED");
  assert.equal(e1.attempts, 2);
  assert.deepEqual(e1.error, err);
  assert.deepEqual(e1.lastError, err);

  assertSchemaValid(e1);
});

test("markOutboxPending: sets PENDING + clears error", () => {
  const e0 = makeEntry({
    status: "FAILED",
    error: { message: "x", at: Date.now() },
    lastError: { message: "x", at: Date.now() },
  } as any);

  const e1 = markOutboxPending(e0, { updatedAt: 111 });
  assert.equal(e1.status, "PENDING");
  assert.equal(e1.updatedAt, 111);
  assert.equal(e1.error, undefined);

  assertSchemaValid(e1);
});

test("canRetry: only FAILED and attempts < maxAttempts", () => {
  assert.equal(canRetry(makeEntry({ status: "PENDING", attempts: 0 })), false);
  assert.equal(
    canRetry(makeEntry({ status: "IN_PROGRESS", attempts: 0 })),
    false,
  );
  assert.equal(canRetry(makeEntry({ status: "APPLIED", attempts: 0 })), false);

  assert.equal(canRetry(makeEntry({ status: "FAILED", attempts: 0 })), true);
  assert.equal(
    canRetry(makeEntry({ status: "FAILED", attempts: 2 }), { maxAttempts: 3 }),
    true,
  );
  assert.equal(
    canRetry(makeEntry({ status: "FAILED", attempts: 3 }), { maxAttempts: 3 }),
    false,
  );
});
