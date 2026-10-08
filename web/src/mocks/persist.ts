import { brandData } from "./brand-deals";
import { idCounter } from "./brief-reader";
import { draftsData } from "./deal-drafts";
import { invitesData } from "./invites";
import { deliverablesData } from "./store";

/*
 * Keeps the mock API's synthetic data across page loads and tabs in a mock
 * build (docs/decisions/2026-10-08-mock-data-kept-in-the-browser.md). The
 * browser worker saves a snapshot after each mocked response and restores it
 * before each request. Never used by Vitest or a production build.
 */

const VERSION = 1;

/** Every mock module's data, as plain JSON-safe values. */
export function snapshotMockData() {
  return {
    version: VERSION,
    ids: idCounter.get(),
    deliverables: deliverablesData.get(),
    drafts: draftsData.get(),
    invites: invitesData.get(),
    brand: brandData.get(),
  };
}

type Snapshot = ReturnType<typeof snapshotMockData>;

const isSnapshot = (v: unknown): v is Snapshot => {
  const s = v as Partial<Snapshot> | null;
  return (
    !!s &&
    s.version === VERSION &&
    typeof s.ids === "number" &&
    typeof s.deliverables === "object" &&
    Array.isArray(s.drafts) &&
    Array.isArray(s.invites?.terms) &&
    Array.isArray(s.brand?.sessions) &&
    Array.isArray(s.brand?.state)
  );
};

/**
 * Puts saved mock data back. Anything that isn't a snapshot of this version
 * is ignored, leaving the seed.
 *
 * @param saved - a parsed snapshot
 * @returns whether it was restored
 */
export function restoreMockData(saved: unknown): boolean {
  if (!isSnapshot(saved)) return false;
  idCounter.set(saved.ids);
  deliverablesData.set(saved.deliverables);
  draftsData.set(saved.drafts);
  invitesData.set(saved.invites);
  brandData.set(saved.brand);
  return true;
}
