import { Actor } from "#/domain/actors/actors.types";

export type PermissionState<TAction extends string> = {
  actor: Actor;
  allow: readonly TAction[];
};
