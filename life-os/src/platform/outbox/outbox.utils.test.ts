import { expect, test } from "vitest"

import { OutboxEntryOpaqueSchema } from "#/platform/outbox/outbox.schemas"
import type { OutboxEntryOpaque } from "#/platform/outbox/outbox.types"

import {
	canRetry,
	markOutboxApplied,
	markOutboxFailed,
	markOutboxInProgress,
	markOutboxPending,
} from "#/platform/outbox/outbox.utils"

function makeEntry(
	overrides: Partial<OutboxEntryOpaque> = {}
): OutboxEntryOpaque {
	const now = Date.now()
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
	} as OutboxEntryOpaque
}

function assertSchemaValid(entry: OutboxEntryOpaque) {
	const res = OutboxEntryOpaqueSchema.safeParse(entry)
	expect(res.success).toBeTruthy()
	if (!res.success) {
		throw new Error(JSON.stringify(res.error.issues, null, 2))
	}
}

test("markOutboxInProgress: sets status, clears error, updates updatedAt", () => {
	const e0 = makeEntry({
		status: "FAILED",
		error: { message: "x", at: Date.now() },
		lastError: { message: "x", at: Date.now() },
	} as any)

	const e1 = markOutboxInProgress(e0, { updatedAt: 123 })
	expect(e1.status).toBe("IN_PROGRESS")
	expect(e1.updatedAt).toBe(123)
	expect(e1.error).toBeUndefined()

	assertSchemaValid(e1)
})

test("markOutboxApplied: sets APPLIED + appliedAt + clears error/lastError", () => {
	const e0 = makeEntry({
		status: "FAILED",
		error: { message: "x", at: Date.now() },
		lastError: { message: "x", at: Date.now() },
	} as any)

	const e1 = markOutboxApplied(e0, { appliedAt: 456 })
	expect(e1.status).toBe("APPLIED")
	expect(e1.appliedAt).toBe(456)
	expect(e1.updatedAt).toBe(456)
	expect(e1.error).toBeUndefined()
	expect(e1.lastError).toBeUndefined()

	assertSchemaValid(e1)
})

test("markOutboxFailed: sets FAILED + increments attempts + sets error + lastError", () => {
	const e0 = makeEntry({ status: "IN_PROGRESS", attempts: 1 })
	const err = { message: "boom", at: 999 }

	const e1 = markOutboxFailed(e0, err)
	expect(e1.status).toBe("FAILED")
	expect(e1.attempts).toBe(2)
	expect(e1.error).toEqual(err)
	expect(e1.lastError).toEqual(err)

	assertSchemaValid(e1)
})

test("markOutboxPending: sets PENDING + clears error", () => {
	const e0 = makeEntry({
		status: "FAILED",
		error: { message: "x", at: Date.now() },
		lastError: { message: "x", at: Date.now() },
	} as any)

	const e1 = markOutboxPending(e0, { updatedAt: 111 })
	expect(e1.status).toBe("PENDING")
	expect(e1.updatedAt).toBe(111)
	expect(e1.error).toBeUndefined()

	assertSchemaValid(e1)
})

test("canRetry: only FAILED and attempts < maxAttempts", () => {
	expect(canRetry(makeEntry({ status: "PENDING", attempts: 0 }))).toBe(false)
	expect(canRetry(makeEntry({ status: "IN_PROGRESS", attempts: 0 }))).toBe(
		false
	)

	expect(canRetry(makeEntry({ status: "APPLIED", attempts: 0 }))).toBe(false)

	expect(canRetry(makeEntry({ status: "FAILED", attempts: 0 }))).toBe(true)
	expect(
		canRetry(makeEntry({ status: "FAILED", attempts: 2 }), { maxAttempts: 3 })
	).toBe(true)
	expect(
		canRetry(makeEntry({ status: "FAILED", attempts: 3 }), { maxAttempts: 3 })
	).toBe(false)
})
