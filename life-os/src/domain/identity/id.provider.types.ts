type ArtifactIdKind = "proposal" | "effects" | "snapshot" | "envelope";
type StageRunIdKind =
  | "intake"
  | "validation"
  | "planning"
  | "execution"
  | "revalidation"
  | "commit";
export type IdKind = ArtifactIdKind | StageRunIdKind;
