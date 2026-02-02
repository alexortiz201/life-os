import { makePermissionSchema } from "#/domain/permissions/permissions.schemas";
import { INGESTION_ACTIONS } from "./ingestion.const";

export const PermissionSchema = makePermissionSchema(INGESTION_ACTIONS);
