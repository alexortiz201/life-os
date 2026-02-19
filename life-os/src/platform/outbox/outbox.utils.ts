import { getNewId } from "#/domain/identity/id.provider"

import type {
	OutboxEntryOpaque,
	OutboxError,
	OutboxStatus,
} from "./outbox.types"

export function nowMs(): number {
	return Date.now()
}

/**
 * Prefer stable ids for durable artifacts.
 * If you already have a dedicated id provider for outbox, swap this.
 */
export function newOutboxId(): string {
	return getNewId("outbox" as any)
}

export function makeOutboxError(params: {
	message: string
	code?: string
	trace?: unknown
	at?: number
}): OutboxError {
	return {
		message: params.message,
		code: params.code,
		trace: params.trace,
		at: params.at ?? nowMs(),
	}
}

/** Status predicates */
export function isPending(entry: Pick<OutboxEntryOpaque, "status">): boolean {
	return entry.status === ("PENDING" satisfies OutboxStatus)
}

export function isApplied(entry: Pick<OutboxEntryOpaque, "status">): boolean {
	return entry.status === ("APPLIED" satisfies OutboxStatus)
}

export function isFailed(entry: Pick<OutboxEntryOpaque, "status">): boolean {
	return entry.status === ("FAILED" satisfies OutboxStatus)
}

/**
 * Pure transition helpers. These *do not* mutate the world.
 * They only return the next entry state.
 *
 * Note: These enforce the BaseOutboxEntrySchema invariants:
 * - FAILED => error must exist
 * - not FAILED => error must be absent
 */

export function markOutboxApplied(
	entry: OutboxEntryOpaque,
	params?: { appliedAt?: number }
): OutboxEntryOpaque {
	const appliedAt = params?.appliedAt ?? nowMs()

	return {
		...entry,
		status: "APPLIED",
		appliedAt,
		updatedAt: appliedAt,

		// schema invariant: error only allowed when FAILED
		error: undefined,

		// keep lastError semantics optional; clearing is reasonable after success
		lastError: undefined,
	}
}

export function markOutboxFailed(
	entry: OutboxEntryOpaque,
	error: OutboxError,
	params?: { failedAt?: number; maxAttempts?: number }
): OutboxEntryOpaque {
	const failedAt = params?.failedAt ?? nowMs()
	const nextAttempts = (entry.attempts ?? 0) + 1

	const attempts =
		typeof params?.maxAttempts === "number"
			? Math.min(nextAttempts, params.maxAttempts)
			: nextAttempts

	return {
		...entry,
		status: "FAILED",
		attempts,
		updatedAt: failedAt,

		// schema invariant: FAILED must include error
		error,

		// lastError can mirror error (useful if you later keep `error` as "terminal")
		lastError: error,
	}
}

export function markOutboxPending(
	entry: OutboxEntryOpaque,
	params?: { updatedAt?: number }
): OutboxEntryOpaque {
	const updatedAt = params?.updatedAt ?? nowMs()

	return {
		...entry,
		status: "PENDING",
		updatedAt,

		// schema invariant: error only allowed when FAILED
		error: undefined,
	}
}

export function markOutboxInProgress(
	entry: OutboxEntryOpaque,
	params?: { updatedAt?: number }
): OutboxEntryOpaque {
	const updatedAt = params?.updatedAt ?? nowMs()

	return {
		...entry,
		status: "IN_PROGRESS",
		updatedAt,

		// schema invariant: error only allowed when FAILED
		error: undefined,
	}
}

/**
 * Basic retry gating. You can make this stricter later (backoff, jitter, etc.)
 */
export function canRetry(
	entry: Pick<OutboxEntryOpaque, "status" | "attempts">,
	opts?: {
		maxAttempts?: number
	}
): boolean {
	if (entry.status !== "FAILED") return false

	const maxAttempts = opts?.maxAttempts ?? 3
	const attempts = entry.attempts ?? 0

	return attempts < maxAttempts
}
