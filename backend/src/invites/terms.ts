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
  /** How the creator read each unclear line of the brief: the answer they picked, their own words, or left out. */
  answers: { briefLine: number; kind: string; text?: string }[];
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
  questions: { briefLine: number; answerKind: string | null; answerText: string | null }[];
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
    answers: deal.questions.flatMap((question) =>
      question.answerKind === null
        ? []
        : [{ briefLine: question.briefLine, kind: question.answerKind, ...(question.answerText === null ? {} : { text: question.answerText }) }],
    ),
  };
}

/** What differs in a version from the one before it: per post, and the items to mark (DS-FR-40). */
export interface TermsChange {
  posts: Record<string, ("amount" | "deadline")[]>;
  /** The ids of items that are reworded, moved to another post, or new. */
  items: string[];
}

/** Says what changed from one version to the next. The first version has none before it, so nothing is marked. */
export function whatChanged(before: TermsSnapshot | undefined, after: TermsSnapshot): TermsChange {
  const change: TermsChange = { posts: {}, items: [] };
  if (!before) return change;

  for (const post of after.posts) {
    const was = before.posts.find((each) => each.deliverableId === post.deliverableId);
    const kinds = [
      ...(was?.amountCents !== post.amountCents ? (["amount"] as const) : []),
      ...(was?.deadlineDays !== post.deadlineDays ? (["deadline"] as const) : []),
    ];
    if (kinds.length) change.posts[post.deliverableId] = kinds;
  }
  for (const item of after.items) {
    const was = before.items.find((each) => each.id === item.id);
    if (!was || was.name !== item.name || was.deliverableId !== item.deliverableId) change.items.push(item.id);
  }
  return change;
}
