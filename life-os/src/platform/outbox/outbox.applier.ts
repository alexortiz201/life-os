import type { OutboxEntryOpaque, OutboxError } from "./outbox.types";
import { markOutboxInProgress } from "./outbox.utils";

/**
 * The Outbox is a durable record of *intent to apply*.
 * The applier is the boundary where world mutation happens.
 *
 * This interface MUST stay narrow and boring.
 * - apply() performs the actual mutation for one entry
 * - markApplied/markFailed update durable state (storage responsibility)
 */
export interface OutboxApplier {
  /**
   * Apply a single entry's effect.
   * This is where side effects happen (DB write, API call, etc).
   *
   * Implementations should be idempotent where possible.
   */
  apply(entry: OutboxEntryOpaque): Promise<void>;

  /**
   * Persist that the entry was applied successfully.
   * (May be combined with apply() in some implementations, but keep the API explicit.)
   */
  markApplied(
    entry: OutboxEntryOpaque,
    params?: { appliedAt?: number },
  ): Promise<void>;

  /**
   * Mark that the entry is in progress.
   */
  markInProgress(
    entry: OutboxEntryOpaque,
    params?: { appliedAt?: number },
  ): Promise<void>;

  /**
   * Persist that the entry failed to apply.
   * Must record an error payload that can be audited.
   */
  markFailed(
    entry: OutboxEntryOpaque,
    error: OutboxError,
    params?: { failedAt?: number },
  ): Promise<void>;
}

/**
 * Optional convenience adapter if you want a single method in higher layers.
 * Keeps commit/apply boundary explicit while making usage ergonomic.
 */
export async function applyOutboxEntry(
  applier: OutboxApplier,
  entry: OutboxEntryOpaque,
): Promise<void> {
  if (entry.status !== "PENDING") return;

  const inProgress = markOutboxInProgress(entry);
  await applier.markInProgress(inProgress);

  try {
    await applier.apply(inProgress);
    await applier.markApplied(inProgress);
  } catch (err) {
    const error: OutboxError = {
      message: err instanceof Error ? err.message : "Unknown apply error",
      trace: err,
      at: Date.now(),
    };
    await applier.markFailed(inProgress, error);
  }
}
