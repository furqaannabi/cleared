import { test as base } from "@playwright/test";

/**
 * The surfaces not yet moved onto the live API run on the mocks, whose one
 * creator starts signed in (SI 1.1). Kept as the one place to sign in once
 * live runs get Furqaan's test session
 * (docs/decisions/2026-10-11-frontend-on-the-live-api.md).
 */
export const test = base;
export { expect, type Page } from "@playwright/test";
