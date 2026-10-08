import { PLATFORM_LABEL } from "@/lib/checklist-builder/checklist-view";
import { formatAmount, sumAmounts } from "@/lib/invite/amount";
import type { BrandDeal, BrandPost, Note } from "./types";

/** Where a checklist item came from (CH-FR-07). */
export type ItemSource = { kind: "brief"; line: string } | { kind: "added" };

/** What the brand's page needs to know, worked out once from the API's data. */
export interface BrandTermsView {
  posts: (Omit<BrandPost, "changed"> & {
    label: string;
    /** What changed on this post since the last version the brand saw (CH-FR-13). */
    changed: ("amount" | "deadline")[];
    items: { id: string; name: string; source: ItemSource; reading?: { line: string; answer: string }; changed: boolean }[];
  })[];
  /** The line above "Agree to these terms" (CH-FR-14). */
  summary: string;
  /** Brief lines no item cites, in brief order; `leftOut` when the creator chose to leave the line out (CH-FR-09). */
  /** Every post's amount added, as a two-place decimal string (CH-FR-05). */
  total: string;
  notOnChecklist: { number: number; text: string; leftOut: boolean }[];
}

/**
 * The brand's view of the terms: each post with its checklist, and where
 * each item came from.
 *
 * @param deal - the deal as the brand sees it, from the API
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-05 to CH-FR-09, CH-FR-14
 */
export function brandTermsView(deal: BrandDeal): BrandTermsView {
  const lineText = new Map(deal.brief.map((l) => [l.number, l.text]));
  // CH-FR-08: lines the creator settled with a suggestion or their own words.
  const readAs = new Map(deal.answers.filter((a) => a.kind !== "left_out" && a.text).map((a) => [a.briefLine, a.text!]));
  const cited = new Set(deal.items.map((i) => i.briefLine));
  const leftOut = new Set(deal.answers.filter((a) => a.kind === "left_out").map((a) => a.briefLine));
  const total = sumAmounts(deal.posts.map((p) => p.amount));
  const n = deal.posts.length;
  return {
    total,
    summary: `You’re agreeing to the checklist for ${n} ${n === 1 ? "post" : "posts"}, ${formatAmount(total)} in total (one hold per post), and how payment works.`,
    notOnChecklist: deal.brief
      .filter((l) => !cited.has(l.number) && l.text.trim())
      .map((l) => ({ number: l.number, text: l.text, leftOut: leftOut.has(l.number) })),
    posts: deal.posts.map((post) => ({
      ...post,
      label: PLATFORM_LABEL[post.platform],
      changed: post.changed ?? [],
      items: deal.items
        .filter((i) => i.deliverableId === post.deliverableId)
        .map((i) => {
          const line = i.addedByCreator || i.briefLine === undefined ? undefined : (lineText.get(i.briefLine) ?? "");
          const answer = i.briefLine === undefined ? undefined : readAs.get(i.briefLine);
          return {
            id: i.id,
            name: i.name,
            source: line === undefined ? { kind: "added" as const } : { kind: "brief" as const, line },
            ...(line !== undefined && answer ? { reading: { line, answer } } : {}),
            changed: !!i.changed,
          };
        }),
    })),
  };
}

/**
 * What a brand's note is about, in words: for the notes list, the creator's
 * view and accessible names.
 *
 * @param deal - the deal's posts, items and brief (the brand's deal, or the creator's draft)
 * @param about - what the note is about
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-12, CH-FR-13, CH-FR-22
 */
export function noteTarget(
  deal: {
    posts: Pick<BrandPost, "deliverableId" | "platform">[];
    items: { id: string; name: string; deliverableId: string }[];
    brief: { number: number; text: string }[];
  },
  about: Note["about"],
): string {
  const postLabel = (id: string) => {
    const p = deal.posts.find((x) => x.deliverableId === id);
    return p ? PLATFORM_LABEL[p.platform] : undefined;
  };
  switch (about.kind) {
    case "item": {
      const item = deal.items.find((i) => i.id === about.itemId);
      return item ? `${item.name} (${postLabel(item.deliverableId)})` : "an item that was removed";
    }
    case "line": {
      const line = deal.brief.find((l) => l.number === about.briefLine);
      return line ? `“${line.text}”` : "a line of the brief";
    }
    case "amount":
    case "deadline": {
      const label = postLabel(about.deliverableId);
      return label ? `the ${about.kind} for the ${label}` : `the ${about.kind} for a post that was removed`;
    }
    default:
      return "this deal";
  }
}
