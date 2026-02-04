import z from "zod";
import { OutboxErrorSchema } from "./outbox.schemas";

/**
 * Outbox is a platform-level construct.
 * It represents intent-to-apply, not application.
 *
 * Creation happens at COMMIT.
 * Application happens elsewhere.
 */

export type OutboxStatus = "PENDING" | "APPLIED" | "FAILED";

/**
 * Generic Outbox Entry
 *
 * TEffect:
 *   The domain-specific effect payload (opaque to platform).
 *
 * TPipeline:
 *   Logical pipeline identifier (e.g. "INGESTION").
 *
 * TStage:
 *   Stage that produced the outbox entry (usually COMMIT).
 */
export type OutboxEntry<
  TEffect = unknown,
  TPipeline extends string = string,
  TStage extends string = string,
> = {
  /** Stable unique identifier for this outbox entry */
  outboxId: string;

  /**
   * Idempotency key.
   * MUST be deterministic for the same logical effect.
   */
  idempotencyKey: string;

  /** Pipeline that produced this entry */
  pipeline: TPipeline;

  /** Stage that emitted the entry (typically COMMIT) */
  stage: TStage;

  /** Effect payload (domain-owned, platform-opaque) */
  effect: TEffect;

  /** Current lifecycle status */
  status: OutboxStatus;

  /** Number of apply attempts */
  attempts: number;

  /** Timestamp bookkeeping */
  createdAt: number;
  appliedAt: number;
  updatedAt: number;

  /** Failure information (only when status === FAILED) */
  error?: OutboxError;
  lastError?: OutboxError;
};

/**
 * Structured failure information.
 * Never throw—errors are data.
 */
export type OutboxError = z.infer<typeof OutboxErrorSchema>;
