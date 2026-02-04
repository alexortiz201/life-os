import { z } from "zod";

import {
  OutboxStatusSchema,
  OutboxErrorSchema,
  BaseOutboxEntrySchema,
  OutboxEntryOpaqueSchema,
  makeOutboxEntrySchema,
} from "./outbox.schemas";

/**
 * Outbox is a platform-level construct.
 * It represents intent-to-apply, not application.
 *
 * Creation happens at COMMIT.
 * Application happens elsewhere.
 */

/** Canonical status union (source of truth = schema) */
export type OutboxStatus = z.infer<typeof OutboxStatusSchema>;

/** Canonical error type (source of truth = schema) */
export type OutboxError = z.infer<typeof OutboxErrorSchema>;

/**
 * Canonical platform-owned entry shape (no effect field).
 * This is the stable contract the platform owns.
 */
export type BaseOutboxEntry = z.infer<typeof BaseOutboxEntrySchema>;

/**
 * Convenience type: opaque effect (platform doesn’t interpret the payload).
 * Matches OutboxEntryOpaqueSchema exactly.
 */
export type OutboxEntryOpaque = z.infer<typeof OutboxEntryOpaqueSchema>;

/**
 * Typed outbox entry shape for pipeline-specific effects.
 * Prefer inferring directly from a concrete schema:
 *   const S = makeOutboxEntrySchema({ effect: MyEffectSchema, pipeline: ..., stage: ... })
 *   type Entry = z.infer<typeof S>
 *
 * But when you already know the types, this is convenient.
 */
export type OutboxEntryOf<
  TEffect,
  TPipeline extends string = string,
  TStage extends string = string,
> = BaseOutboxEntry & {
  pipeline: TPipeline;
  stage: TStage;
  effect: TEffect;
};

/**
 * Export factory type so callers can reference it in signatures if they want.
 */
export type MakeOutboxEntrySchema = typeof makeOutboxEntrySchema;
