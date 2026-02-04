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

export const BaseOutboxEntryCoreSchema = z
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
    error: OutboxErrorSchema.optional(),
    lastError: OutboxErrorSchema.optional(),
  })
  .strict();

export const refineOutboxEntry = <T extends z.ZodTypeAny>(schema: T) =>
  schema.superRefine((val: any, ctx: any) => {
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
  const schema = BaseOutboxEntryCoreSchema.extend({
    pipeline: params.pipeline ?? BaseOutboxEntryCoreSchema.shape.pipeline,
    stage: params.stage ?? BaseOutboxEntryCoreSchema.shape.stage,
    effect: params.effect,
  });

  return refineOutboxEntry(schema);
};

/** -----------------------------
 *  Convenience: opaque effect
 *  ---------------------------- */

export const OutboxEntryOpaqueSchema = makeOutboxEntrySchema({
  effect: z.unknown(),
});
