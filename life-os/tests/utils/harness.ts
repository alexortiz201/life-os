import { pipe } from "fp-ts/function";
import * as E from "fp-ts/Either";

function stage1(env) {
  // return E.right(env2) or E.left(error)
}

export function runSpine(env, stages[]){
  const pipeline = pipe(
    E.of,   // start from Right
    E.chain(stage1),
    E.chain(stage2),
    E.chain(stage3)
  );

  const result = pipeline(env);

  stages
  // intakeStage(env: IntakeEnvelope)
}
export function expectHalt(env, { stage, code }){}
export function expectHasRun(env, stageName){}

// export function assertNoHaltingErrors(
//   envelope: StageOutput,
//   beforeStage: PipelineStage
// ) {
//   const halts = envelope.errors.filter((e) => e.severity === "HALT");
//   if (halts.length) throw new Error(`PIPELINE_HALTED_BEFORE_${beforeStage}`);
// }