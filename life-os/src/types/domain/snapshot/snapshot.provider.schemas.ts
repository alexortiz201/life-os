import { z } from "zod";

export const ContextSnapshotSchema = z.object({
  permissions: z.object({
    actor: z.string().min(1),
    allow: z.array(z.literal("WEEKLY_REFLECTION")).readonly(),
  }),
  scope: z.object({
    allowedKinds: z.array(z.literal("NOTE")).readonly(),
  }),
  invariantsVersion: z.string().min(1),
  timestampMs: z.number().int().nonnegative(),
  dependencyVersions: z.record(z.string(), z.string()).optional(),
});
