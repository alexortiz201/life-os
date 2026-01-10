// import { StageOutput } from "#/types/rna/pipeline/ingestion/ingestion.types";
// import { PipelineStage } from "#/types/rna/pipeline/pipeline.types";

export const errorResultFactory =
  <TTrace>() =>
  ({
    code,
    message,
    trace,
  }: {
    code: string;
    message: string;
    trace: TTrace;
  }) => ({ ok: false as const, code, message, trace });

// export function assertNoHaltingErrors(
//   envelope: StageOutput,
//   beforeStage: PipelineStage
// ) {
//   const halts = envelope.errors.filter((e) => e.severity === "HALT");
//   if (halts.length) throw new Error(`PIPELINE_HALTED_BEFORE_${beforeStage}`);
// }
