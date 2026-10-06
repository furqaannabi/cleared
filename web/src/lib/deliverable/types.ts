import type { ItemStatus } from "@/lib/checklist/item-status";

/*
 * Provisional: the creator draft check FRD's mock shape
 * (docs/specs/creator-draft-check-frd.md, "Mocks and the provisional
 * contract"). Moves to contract/ once the API contract is agreed.
 */

/** DC-FR-01: the six page states, reported by the API. */
export type DeliverableState = "no_draft" | "checking" | "results" | "fully_passing" | "check_failed" | "released";

export interface ChecklistItem {
  id: string;
  name: string;
  status: ItemStatus;
  /** DC-FR-19: the status in the previous run, from run 2 on. */
  previousStatus?: ItemStatus;
}

/** DC-FR-08, DC-FR-09: why a check could not run. */
export type CheckFailure =
  | { kind: "file"; reason: "unreadable" | "format" | "too_long" | "not_same_video"; fileName: string; lengthSec?: number; lengthCapSec?: number }
  | { kind: "ours"; retrying: boolean; fileName: string };

/** DC-FR-27: the PayPal hold for this deliverable. Amounts are integer minor units. */
export interface Hold {
  amountMinor: number;
  currency: string;
}

export interface Deliverable {
  id: string;
  brandName: string;
  state: DeliverableState;
  /** The post-by deadline, an ISO 8601 timestamp. */
  deadline: string;
  items: ChecklistItem[];
  hold: Hold;
  /** DC-FR-07: when the brand's review window ends, once it has started. */
  reviewWindowEndsAt?: string;
  checkFailure?: CheckFailure;
  /** DC-FR-10: when and why the hold went back to the brand. */
  releasedAt?: string;
  releaseReason?: "deadline" | "cancelled";
  cancelledBy?: "creator" | "brand";
}
