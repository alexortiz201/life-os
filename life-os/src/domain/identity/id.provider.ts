import type { IdKind } from "./id.provider.types"

const PREFIX: Record<IdKind, string> = {
	// records
	outbox: "outbox",

	// artifacts
	proposal: "proposal",
	effects: "effects",
	snapshot: "snapshot",
	envelope: "envelope",

	// stages
	intake: "intake",
	validation: "validation",
	planning: "planning",
	execution: "execution",
	revalidation: "revalidation",
	commit: "commit",
}

export const getNewId = (kind: IdKind): string => {
	return `${PREFIX[kind]}_${crypto.randomUUID()}`
}
