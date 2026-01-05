import z from "zod";
import { CommitInputSchema, ProducedObjectSchema } from "./commit.schemas";

export type TrustPromotionRecord = {
  objectId: string;
  from: "PROVISIONAL";
  to: "COMMITTED";
  stage: "COMMIT";
  reason: string;
  proposalId: string;
  effectsLogId: string;
  commitId: string;
};

type ProducedObject = z.infer<typeof ProducedObjectSchema>;

// export type CommitRecord = {
//   commitId: string;
//   proposalId: string;
//   committedObjects: Array<{
//     objectId: string;
//     kind: string;
//     trust: "COMMITTED";
//   }> | [];
//   promotions: Array<TrustPromotionRecord>;
// };

export type CommitRecord = {
  commitId: string;
  proposalId: string;
  committedObjects: Array<{
    objectId: string;
    kind: string;
    trust: "COMMITTED";
  }>;
  promotions: Array<TrustPromotionRecord>;
};

export type CommitInput = z.infer<typeof CommitInputSchema>;

export type GuardPrecommitResult =
  | {
      ok: true;
      code: "PARTIAL_COMMIT_EMPTY_ALLOWLIST" | "SUCCESS";
      data: CommitInput & {
        mode: "FULL" | "PARTIAL";
        commitSet: Array<ProducedObject> | [];
      };
    }
  | { ok: false; code: string; message: string };
