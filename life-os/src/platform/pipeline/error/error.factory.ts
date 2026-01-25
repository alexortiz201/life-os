import { EnvelopeStage } from "#/rna/envelope/envelope.types";
import {
  GuardError,
  GuardTrace,
} from "#/rna/pipeline/pipeline-utils/guard-utils.types";

type FactoryGuardError<
  TStage,
  TCode extends string,
  TRule extends string,
  TTrace
> = Omit<GuardError<TStage, TCode, TRule, TTrace>, "stage" | "code"> & {
  stage: TStage | EnvelopeStage;
  code: TCode | string;
};

export type ErrorFn<TStage, TCode extends string> = <
  TTrace extends Record<string, unknown>,
  TRule extends string
>(
  trace: GuardTrace<TTrace, TRule>
) => FactoryGuardError<TStage, TCode, TRule, TTrace>;

export const errorResultFactory =
  <TStage, TCode extends string>(defaults: {
    stage: TStage;
    code: TCode;
    message?: string;
  }) =>
  (args: any) => {
    const { stage: s, code: c, message: m, ...trace } = args;

    const stage = s ?? defaults.stage;
    const code = c ?? defaults.code;
    const message = m ?? defaults.message ?? `${String(stage)}: Invalid input`;

    return {
      ok: false as const,
      stage,
      code,
      message,
      trace: { ...trace, mode: trace.mode ?? "UNKNOWN" },
    };
  };

// export function assertNoHaltingErrors(
//   envelope: StageOutput,
//   beforeStage: PipelineStage
// ) {
//   const halts = envelope.errors.filter((e) => e.severity === "HALT");
//   if (halts.length) throw new Error(`PIPELINE_HALTED_BEFORE_${beforeStage}`);
// }
