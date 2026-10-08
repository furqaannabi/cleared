import { restoreMockData, snapshotMockData } from "./persist";
import { resetMockData } from "./store";

/*
 * Browser only, mock builds only: the mock data in this browser's
 * localStorage (docs/decisions/2026-10-08-mock-data-kept-in-the-browser.md).
 * Synthetic data only; the brand "session" in it is the mock's stand-in, not
 * a real session or token. Each save carries a stamp, so a tab reloads the
 * data only when another tab (or a page load) has saved since it last looked.
 */
const DATA = "cleared-mock-data";
const STAMP = "cleared-mock-stamp";
let known: string | null = null;

const read = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** Brings this tab's mock data up to date with the saved copy, if another tab or load saved since. */
export function loadSaved() {
  const stamp = read(STAMP);
  if (!stamp || stamp === known) return;
  known = stamp;
  try {
    restoreMockData(JSON.parse(read(DATA) ?? "null"));
  } catch {
    // Unreadable: keep what this tab has.
  }
}

/** Saves this tab's mock data for the next request, page load or tab. */
export function save() {
  try {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(DATA, JSON.stringify(snapshotMockData()));
    window.localStorage.setItem(STAMP, stamp);
    known = stamp;
  } catch {
    // Storage full or blocked: the mocks still work for this page.
  }
}

/** Back to the seeded demo data, in every tab. */
export function resetSaved() {
  resetMockData();
  save();
}
