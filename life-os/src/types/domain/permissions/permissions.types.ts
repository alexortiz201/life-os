import { Actor } from "../actors/actors.types";
import { PERMISSIONS } from "./permissions.const";

export type Permission = (typeof PERMISSIONS)[number];

export type PermissionState<TPerm extends string> = {
  actor: Actor;
  allow: readonly TPerm[];
};
