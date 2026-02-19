import { createHash } from "node:crypto"
import { stableStringify } from "./canonicalize"

export function fingerprint(input: unknown): string {
	const canonical = stableStringify(input)
	return createHash("sha256").update(canonical).digest("hex")
}
