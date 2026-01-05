import { CommitInputSchema } from "./commit.schemas";
import { GuardPrecommitResult } from "./commit.types";

const makeErrorResult = ({
  code,
  message,
}: {
  code: string;
  message: string;
}) =>
  ({ ok: false, code, message } as {
    ok: false;
    code: string;
    message: string;
  });

export function guardPrecommit(input: unknown): GuardPrecommitResult {
  const parsed = CommitInputSchema.safeParse(input);

  if (!parsed.success) {
    return makeErrorResult({
      code: "INVALID_COMMIT_INPUT",
      message: "Input invalid",
    });
  }

  const data = parsed.data;
  const { revalidation, effectsLog, proposalId } = data;

  // Minimal safety: ensure everything is linked to the same proposal
  if (revalidation.proposalId !== proposalId) {
    return makeErrorResult({
      code: "COMMIT_INPUT_MISMATCH",
      message: "revalidation.proposalId does not match proposalId",
    });
  }
  if (effectsLog.proposalId !== proposalId) {
    return makeErrorResult({
      code: "COMMIT_INPUT_MISMATCH",
      message: "effectsLog.proposalId does not match proposalId",
    });
  }

  if (!["APPROVE_COMMIT", "PARTIAL_COMMIT"].includes(revalidation.outcome)) {
    return makeErrorResult({
      code: "COMMIT_OUTCOME_UNSUPPORTED",
      message: "partial or full approval required",
    });
  }

  if (
    revalidation.outcome === "PARTIAL_COMMIT" &&
    !revalidation.commitAllowList.length
  ) {
    return {
      ok: true,
      code: "PARTIAL_COMMIT_EMPTY_ALLOWLIST",
      data: {
        mode: "PARTIAL",
        commitSet: [],
        ...data,
      },
    };
  }

  const provisionalObjects: typeof effectsLog.producedObjects = [];
  const producedObjectsIds = effectsLog.producedObjects.reduce((acc, o) => {
    if (o.trust === "PROVISIONAL") provisionalObjects.push(o);

    acc.push(o.objectId);

    return acc;
  }, [] as string[]);
  const producedObjectsIdsSet = new Set(producedObjectsIds);
  const unknownAllowListObjects = revalidation.commitAllowList.filter(
    (s) => !producedObjectsIdsSet.has(s)
  );

  if (
    revalidation.outcome !== "APPROVE_COMMIT" &&
    unknownAllowListObjects.length
  ) {
    return makeErrorResult({
      code: "ALLOWLIST_UNKNOWN_OBJECT",
      message: "unknown allowlist object",
    });
  }

  if (revalidation.outcome === "PARTIAL_COMMIT") {
    const commitAllowListSet = new Set(revalidation.commitAllowList);
    const allowListObjects = provisionalObjects.filter((o) =>
      commitAllowListSet.has(o.objectId)
    );
    return {
      ok: true,
      code: "SUCCESS",
      data: {
        mode: "PARTIAL",
        commitSet: [...allowListObjects],
        ...data,
      },
    };
  }

  return {
    ok: true,
    code: "SUCCESS",
    data: {
      mode: "FULL",
      commitSet: [...provisionalObjects],
      ...data,
    },
  };
}
