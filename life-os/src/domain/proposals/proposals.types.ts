// biome-ignore lint/style/useImportType: const used in `typeof` for type derivation
import { IMPACT, REVERSIBILITY_CLAIM } from "./proposals.const"

export type ReversibilityClaim = (typeof REVERSIBILITY_CLAIM)[number]
export type Impact = (typeof IMPACT)[number]
