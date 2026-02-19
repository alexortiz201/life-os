import type { z } from "zod";

// biome-ignore lint/style/useImportType: schemas used in `typeof` for type derivation
import { TrustLevelSchema } from "./trust.schemas";

export type TrustLevel = z.infer<typeof TrustLevelSchema>;
