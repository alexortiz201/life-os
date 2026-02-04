import { getNewId } from "#/domain/identity/id.provider";

import type { OutboxEntry, OutboxError, OutboxStatus } from "./outbox.types";

export function nowMs(): number {
  return Date.now();
}

/**
 * Prefer stable ids for durable artifacts.
 * If you already have a dedicated id provider for outbox, swap this.
 */
export function newOutboxId(): string {
  // If you don't have `getNewId("outbox")`, either:
  // - add it, or
  // - keep `getNewId("event")` etc.
  // This is the cleanest: register "outbox" in your id.provider.
  return getNewId("outbox" as any);
}

export function makeOutboxError(params: {
  message: string;
  code?: string;
  trace?: unknown;
  at?: number;
}): OutboxError {
  return {
    message: params.message,
    code: params.code,
    trace: params.trace,
    at: params.at ?? nowMs(),
  };
}

export function isPending(entry: Pick<OutboxEntry, "status">): boolean {
  return entry.status === ("PENDING" as OutboxStatus);
}

export function isApplied(entry: Pick<OutboxEntry, "status">): boolean {
  return entry.status === ("APPLIED" as OutboxStatus);
}

export function isFailed(entry: Pick<OutboxEntry, "status">): boolean {
  return entry.status === ("FAILED" as OutboxStatus);
}

/**
 * Pure transition helpers. These *do not* mutate the world.
 * They only return the next entry state.
 */
export function markOutboxApplied(
  entry: OutboxEntry,
  params?: { appliedAt?: number },
): OutboxEntry {
  const appliedAt = params?.appliedAt ?? nowMs();

  return {
    ...entry,
    status: "APPLIED",
    appliedAt,
    // once applied, failure should be cleared (audit still lives in history if you keep it)
    lastError: undefined,
    updatedAt: appliedAt,
  };
}

export function markOutboxFailed(
  entry: OutboxEntry,
  error: OutboxError,
  params?: { failedAt?: number; maxAttempts?: number },
): OutboxEntry {
  const failedAt = params?.failedAt ?? nowMs();
  const nextAttempts = (entry.attempts ?? 0) + 1;

  // Optional: clamp attempts if you enforce a ceiling.
  const attempts =
    typeof params?.maxAttempts === "number"
      ? Math.min(nextAttempts, params.maxAttempts)
      : nextAttempts;

  return {
    ...entry,
    status: "FAILED",
    attempts,
    lastError: error,
    updatedAt: failedAt,
  };
}

export function markOutboxPending(
  entry: OutboxEntry,
  params?: { updatedAt?: number },
): OutboxEntry {
  const updatedAt = params?.updatedAt ?? nowMs();

  return {
    ...entry,
    status: "PENDING",
    updatedAt,
  };
}

/**
 * Basic retry gating. You can make this stricter later (backoff, jitter, etc.)
 */
export function canRetry(
  entry: Pick<OutboxEntry, "status" | "attempts">,
  opts?: {
    maxAttempts?: number;
  },
): boolean {
  if (entry.status !== "FAILED") return false;

  const maxAttempts = opts?.maxAttempts ?? 3;
  const attempts = entry.attempts ?? 0;

  return attempts < maxAttempts;
}
