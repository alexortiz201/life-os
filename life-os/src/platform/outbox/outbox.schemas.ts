import { z } from "zod";

import type { OutboxEntry, OutboxStatus } from "./outbox.types";

/**
 * Platform-level schemas.
 *
 * NOTE:
 * - The platform does NOT know the shape of `effect`.
 * - Provide an effect schema when you know it (pipeline/domain side).
 */

/** -----------------------------
 *  Primitives
 *  ---------------------------- */

export const OutboxStatusSchema = z.union([
  z.literal("PENDING"),
  z.literal("APPLIED"),
  z.literal("FAILED"),
]) satisfies z.ZodType<OutboxStatus>;

export const OutboxErrorSchema = z
  .object({
    message: z.string().min(1),
    code: z.string().min(1).optional(),
    trace: z.unknown().optional(),
    at: z.number().int().nonnegative(),
  })
  .strict();

/** -----------------------------
 *  Generic Entry Schema Factory
 *  ---------------------------- */

/**
 * Factory so each pipeline can supply an `effect` schema.
 * If you truly want "opaque effect" at runtime, pass z.unknown().
 */
export const makeOutboxEntrySchema = <
  TEffectSchema extends z.ZodTypeAny,
  TPipeline extends string = string,
  TStage extends string = string,
>(params: {
  effect: TEffectSchema;
  /**
   * Optional: constrain pipeline/stage to specific literal unions.
   * If omitted, they are just strings.
   */
  pipeline?: z.ZodType<TPipeline>;
  stage?: z.ZodType<TStage>;
}) => {
  const pipelineSchema = params.pipeline ?? (z.string().min(1) as any);
  const stageSchema = params.stage ?? (z.string().min(1) as any);

  return z
    .object({
      outboxId: z.string().min(1),
      idempotencyKey: z.string().min(1),

      pipeline: pipelineSchema,
      stage: stageSchema,

      effect: params.effect,

      status: OutboxStatusSchema,
      attempts: z.number().int().nonnegative(),

      createdAt: z.number().int().nonnegative(),
      appliedAt: z.number().int().nonnegative(),
      updatedAt: z.number().int().nonnegative(),

      error: OutboxErrorSchema.optional(),
      lastError: OutboxErrorSchema.optional(),
    })
    .strict()
    .superRefine((val, ctx) => {
      // If FAILED => must have error
      if (val.status === "FAILED" && !val.error) {
        ctx.addIssue({
          code: "custom",
          message: "FAILED outbox entry must include `error`.",
          path: ["error"],
        });
      }

      // If not FAILED => should not have error (optional, but helps correctness)
      if (val.status !== "FAILED" && val.error) {
        ctx.addIssue({
          code: "custom",
          message: "`error` may only be present when status is FAILED.",
          path: ["error"],
        });
      }
    });
};

/** -----------------------------
 *  Convenience: opaque effect
 *  ---------------------------- */

export const OutboxEntryOpaqueSchema = makeOutboxEntrySchema({
  effect: z.unknown(),
}) satisfies z.ZodType<OutboxEntry>;

/** -----------------------------
 *  Helpers
 *  ---------------------------- */

export type OutboxEntryOpaque = z.infer<typeof OutboxEntryOpaqueSchema>;
