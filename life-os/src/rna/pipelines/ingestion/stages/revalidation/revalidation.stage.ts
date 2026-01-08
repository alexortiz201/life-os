import type {
  RevalidationDirectiveReady,
  RevalidationInput,
} from "#types/rna/pipeline/ingestion/revalidation/revalidation.types";
import { guardRevalidation } from "./revalidation.guard";

export function revalidationStage(
  input: RevalidationInput
): RevalidationDirectiveReady {
  const result = guardRevalidation(input);

  if (!result.ok) {
    throw new Error(`${result.code}: ${result.message}`);
  }

  return result.data;
}
