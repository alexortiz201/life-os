import test from "node:test";
import assert from "node:assert/strict";

import type { OutboxApplier } from "#/platform/outbox/outbox.applier";
import { applyOutboxEntry } from "#/platform/outbox/outbox.applier";
import type {
  OutboxEntryOpaque,
  OutboxError,
} from "#/platform/outbox/outbox.types";

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

test("applyOutboxEntry: no-ops when entry.status !== PENDING", async () => {
  const calls: string[] = [];

  const applier: OutboxApplier = {
    async apply() {
      calls.push("apply");
    },
    async markApplied() {
      calls.push("markApplied");
    },
    async markInProgress() {
      calls.push("markInProgress");
    },
    async markFailed() {
      calls.push("markFailed");
    },
  };

  await applyOutboxEntry(applier, makeEntry({ status: "IN_PROGRESS" }));
  await applyOutboxEntry(applier, makeEntry({ status: "APPLIED" }));
  await applyOutboxEntry(applier, makeEntry({ status: "FAILED" }));

  assert.deepEqual(calls, []);
});

test("applyOutboxEntry: marks IN_PROGRESS first, then apply, then markApplied", async () => {
  const calls: Array<{ name: string; status?: string }> = [];

  const applier: OutboxApplier = {
    async markInProgress(e) {
      calls.push({ name: "markInProgress", status: e.status });
      assert.equal(e.status, "IN_PROGRESS");
    },
    async apply(e) {
      calls.push({ name: "apply", status: e.status });
      assert.equal(e.status, "IN_PROGRESS");
    },
    async markApplied(e) {
      calls.push({ name: "markApplied", status: e.status });
      // note: you pass the same IN_PROGRESS entry to markApplied currently
      assert.equal(e.status, "IN_PROGRESS");
    },
    async markFailed() {
      calls.push({ name: "markFailed" });
    },
  };

  await applyOutboxEntry(applier, makeEntry({ status: "PENDING" }));

  assert.deepEqual(
    calls.map((c) => c.name),
    ["markInProgress", "apply", "markApplied"],
  );
});

test("applyOutboxEntry: on apply() throw => markFailed called with OutboxError", async () => {
  const calls: Array<{ name: string; error?: OutboxError }> = [];

  const applier: OutboxApplier = {
    async markInProgress() {
      calls.push({ name: "markInProgress" });
    },
    async apply() {
      calls.push({ name: "apply" });
      throw new Error("boom");
    },
    async markApplied() {
      calls.push({ name: "markApplied" });
    },
    async markFailed(_e, error) {
      calls.push({ name: "markFailed", error });
      assert.equal(typeof error.message, "string");
      assert.ok(error.message.includes("boom"));
      assert.equal(typeof error.at, "number");
    },
  };

  await applyOutboxEntry(applier, makeEntry({ status: "PENDING" }));

  assert.deepEqual(
    calls.map((c) => c.name),
    ["markInProgress", "apply", "markFailed"],
  );
});
