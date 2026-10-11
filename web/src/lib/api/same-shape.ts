/**
 * `true` only when A and B are each assignable to the other: a page's Zod
 * schema matches the contract's type exactly, so a change to the contract
 * fails type-checking until the schema follows
 * (docs/decisions/2026-10-11-frontend-on-the-live-api.md).
 */
export type SameShape<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
