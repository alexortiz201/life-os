import { z } from "zod";

export const OutboxStatusSchema = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "APPLIED",
  "FAILED",
]);

export const OutboxErrorSchema = z.object({
  message: z.string().min(1),
  code: z.string().min(1).optional(),
  trace: z.unknown().optional(),
  at: z.number().int().nonnegative(),
});

export const BaseOutboxEntrySchema = z
  .object({
    outboxId: z.string().min(1),
    idempotencyKey: z.string().min(1),

    pipeline: z.string().min(1),
    stage: z.string().min(1),

    status: OutboxStatusSchema,
    attempts: z.number().int().nonnegative().default(0),

    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    appliedAt: z.number().int().nonnegative().optional(),

    // Prefer ONE canonical field. If you keep both, be explicit about semantics.
    error: OutboxErrorSchema.optional(),
    lastError: OutboxErrorSchema.optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.status === "FAILED" && !val.error) {
      ctx.addIssue({
        code: "custom",
        message: "FAILED outbox entry must include `error`.",
        path: ["error"],
      });
    }

    if (val.status !== "FAILED" && val.error) {
      ctx.addIssue({
        code: "custom",
        message: "`error` may only be present when status is FAILED.",
        path: ["error"],
      });
    }
  });

export const makeOutboxEntrySchema = <
  TEffectSchema extends z.ZodTypeAny,
  TPipeline extends string = string,
  TStage extends string = string,
>(params: {
  effect: TEffectSchema;
  pipeline?: z.ZodType<TPipeline>;
  stage?: z.ZodType<TStage>;
}) => {
  return BaseOutboxEntrySchema.extend({
    // override pipeline/stage to be constrained if supplied
    pipeline: params.pipeline ?? BaseOutboxEntrySchema.shape.pipeline,
    stage: params.stage ?? BaseOutboxEntrySchema.shape.stage,

    // inject effect schema
    effect: params.effect,
  });
};

/** -----------------------------
 *  Convenience: opaque effect
 *  ---------------------------- */

export const OutboxEntryOpaqueSchema = makeOutboxEntrySchema({
  effect: z.unknown(),
});
