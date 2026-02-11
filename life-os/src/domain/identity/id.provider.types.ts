type ArtifactIdKind =
  | "proposal"
  | "effects"
  | "snapshot"
  | "envelope"
  | "outbox";

type StageRunIdKind =
  | "intake"
  | "validation"
  | "planning"
  | "execution"
  | "revalidation"
  | "commit";

type DurableRecordIdKind = "outbox";

export type IdKind = ArtifactIdKind | StageRunIdKind | DurableRecordIdKind;
