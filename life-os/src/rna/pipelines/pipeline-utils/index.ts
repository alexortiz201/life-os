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
