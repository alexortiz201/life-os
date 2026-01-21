import {
  GuardError,
  GuardTrace,
} from "#/types/rna/pipeline/pipeline-utils/guard-utils.types";

type ClosuredParams<TStage, TCode> = {
  code: TCode;
  message?: string;
  stage: TStage;
};

export type ErrorFn<TStage, TCode extends string> = <
  TTrace extends Record<string, unknown>,
  TParseRule extends string
>(
  trace: GuardTrace<TTrace, TParseRule>
) => GuardError<TStage, TCode, TParseRule, TTrace>;

type ErrorResultFactory = <TStage, TCode extends string>({
  stage,
  code,
  message,
}: ClosuredParams<TStage, TCode>) => ErrorFn<TStage, TCode>;

export const errorResultFactory: ErrorResultFactory =
  ({ stage, code, message }) =>
  (trace) => ({
    ok: false as const,
    code,
    stage,
    message: message ?? `${String(stage)}: Invalid input`,
    trace: { ...trace },
  });

// export function assertNoHaltingErrors(
//   envelope: StageOutput,
//   beforeStage: PipelineStage
// ) {
//   const halts = envelope.errors.filter((e) => e.severity === "HALT");
//   if (halts.length) throw new Error(`PIPELINE_HALTED_BEFORE_${beforeStage}`);
// }
