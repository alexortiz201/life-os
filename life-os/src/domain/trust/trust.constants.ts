export const TRUST_LEVELS = [
  "UNTRUSTED",
  "PROVISIONAL",
  "COMMITTED",
  "DERIVED",
] as const;

export const TRUST_RANK = {
  UNTRUSTED: 0,
  PROVISIONAL: 1,
  COMMITTED: 2,
  DERIVED: 3,
} as const;
