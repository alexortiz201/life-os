import { z } from "zod";

import { PERMISSIONS } from "#/domain/permissions/permissions.const";
import { KINDS } from "#/domain/scopes/scopes.const";

export const IngestionContextSnapshotSchema = z.object({
  permissions: z.object({
    actor: z.string().min(1),
    allow: z.array(z.literal(PERMISSIONS)).readonly(),
  }),
  scope: z.object({
    allowedKinds: z.array(z.literal(KINDS)).readonly(),
  }),
  invariantsVersion: z.string().min(1),
  timestampMs: z.number().int().nonnegative(),
  dependencyVersions: z.record(z.string(), z.string()).optional(),
});
