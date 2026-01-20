import z from "zod";

export const makeScopeSchema = <T extends z.ZodTypeAny>(KindSchema: T) =>
  z.object({
    allowedKinds: z.array(KindSchema).readonly(),
  });
