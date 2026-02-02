import z from "zod";

import { ActorSchema } from "#/domain/actors/actors.schemas";

export const makePermissionSchema = <
  const TAllowActions extends readonly [string, ...string[]],
>(
  allowActions: TAllowActions,
) => {
  const AllowActionsEnum = z.enum(allowActions);
  return z.object({
    actor: ActorSchema,
    allow: z.array(AllowActionsEnum).readonly(),
  });
};
