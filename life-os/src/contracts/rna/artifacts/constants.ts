export const TRUST_LEVELS = [
  "UNTRUSTED",
  "PROVISIONAL",
  "COMMITTED",
  "DERIVED",
] as const;
export type TrustLevel = (typeof TRUST_LEVELS)[number];

export const ACTOR_TYPES = ["USER", "AGENT", "SYSTEM"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];
