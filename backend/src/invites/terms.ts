/**
 * A deal's terms: what an amount is, and a version of the terms and the checklist as they were sent to
 * the brand (deal set-up spec DS-FR-29, DS-FR-31, DS-BR-12).
 */

/**
 * A US-dollar amount, given as a decimal string with two places, in whole cents. Undefined for anything
 * else. Read digit by digit, so no amount is ever a floating-point number (DS-BR-12).
 */
export function cents(amount: string): number | undefined {
  const match = /^(\d{1,7})\.(\d{2})$/.exec(amount);
  if (!match) return undefined;
  return Number.parseInt(match[1]!, 10) * 100 + Number.parseInt(match[2]!, 10);
}

/** Where an item came from: a line of the brief, the creator's answer about an unclear line, or the creator. */
export type ItemSource = "brief" | "answer" | "creator";

/** The terms and the checklist exactly as one version sent them. */
export interface TermsSnapshot {
  posts: { deliverableId: string; platform: string; amountCents: number; deadlineDays: number }[];
  items: {
    id: string;
    deliverableId: string;
    name: string;
    kind: string;
    briefLine?: number;
    exact?: string;
    checkedBy: string;
    source: ItemSource;
  }[];
}

/** Takes a version of a deal's terms and checklist. Every post must have its amount and its deadline. */
export function takeSnapshot(deal: {
  deliverables: { id: string; platform: string; amountCents: number | null; deadlineDays: number | null }[];
  items: {
    id: string;
    deliverableId: string;
    name: string;
    kind: string;
    briefLine: number | null;
    addedByCreator: boolean;
    exact: string | null;
    checkedBy: string;
    questionId: string | null;
  }[];
}): TermsSnapshot {
  return {
    posts: deal.deliverables.map((post) => {
      if (post.amountCents === null || post.deadlineDays === null) throw new Error("A post has no amount or no deadline yet");
      return { deliverableId: post.id, platform: post.platform, amountCents: post.amountCents, deadlineDays: post.deadlineDays };
    }),
    items: deal.items.map((item) => ({
      id: item.id,
      deliverableId: item.deliverableId,
      name: item.name,
      kind: item.kind,
      ...(item.briefLine === null ? {} : { briefLine: item.briefLine }),
      ...(item.exact === null ? {} : { exact: item.exact }),
      checkedBy: item.checkedBy,
      source: item.addedByCreator ? "creator" : item.questionId ? "answer" : "brief",
    })),
  };
}
