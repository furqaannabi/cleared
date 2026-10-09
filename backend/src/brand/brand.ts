/**
 * The deal as its brand sees it, and what the brand does with it: ask for changes, or agree (deal set-up
 * spec DS-FR-36, DS-FR-38, DS-FR-41, DS-FR-42). Everything shown comes from the latest version sent to
 * the brand, so it sees exactly what it is asked to agree to (DS-BR-10), not what the creator is in the
 * middle of editing. Nothing returned here carries the creator's PayPal email, their own email or their
 * accounts (DS-BR-13).
 *
 * Every function is for a caller already known to hold a brand's session for the deal.
 */
import type { BriefLine } from "../briefs/reader";
import type { Platform } from "../deals/deals";
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { inOrder, noteOf, type DealNote, type NoteAbout } from "../invites/notes";
import { whatChanged, type TermsSnapshot } from "../invites/terms";
import type { Money } from "../money/money";
import { decimal } from "../money/view";

export interface BrandDeal {
  dealId: string;
  creatorName: string;
  brandName: string;
  step: "waiting_for_brand" | "changes_requested" | "agreed";
  /** The version shown, which is the one the brand can agree to. */
  version: number;
  /** When the brand agreed, once it has. */
  agreedAt?: string;
  posts: {
    deliverableId: string;
    platform: Platform;
    /** US dollars, as a decimal string with two places (DS-BR-12). */
    amount: string;
    deadlineDays: number;
    /** What differs from the version before this one (DS-FR-40). */
    changed?: ("amount" | "deadline")[];
    /** No hold can be started before the brand agrees (DS-BR-10). */
    hold: { state: "not_started" };
  }[];
  items: {
    id: string;
    deliverableId: string;
    name: string;
    /** The brief line it cites. Absent only for an item the creator added. */
    briefLine?: number;
    addedByCreator: boolean;
    /** Reworded, moved or new since the version before this one (DS-FR-40). */
    changed?: boolean;
  }[];
  /** The whole brief as numbered lines of plain text, so the lines no item cites can be shown too. */
  brief: BriefLine[];
  /** How the creator read each unclear line. An item citing one of these lines is the creator's reading of it. */
  answers: { briefLine: number; kind: "suggestion" | "own_words" | "left_out"; text?: string }[];
  /** The brand's own notes, each with the creator's reply if there is one. */
  notes: DealNote[];
}

export type NotesRefused =
  /** Notes are sent while the deal waits for the brand: not again before the creator answers, and not once agreed. */
  | { refused: "not_waiting_for_brand" }
  /** A note is about something that is not in the version the brand was shown. `index` is its place in what was sent. */
  | { refused: "unknown_subject"; index: number };

export type AgreeRefused =
  | { refused: "already_agreed" }
  /** The creator is answering the brand's changes, so there is nothing to agree to yet. */
  | { refused: "not_waiting_for_brand" }
  /** The version named is not the latest: the creator has sent a newer one (DS-FR-41). */
  | { refused: "out_of_date" }
  /** The service has no PayPal set up, so it cannot open the money an agreement needs. */
  | { refused: "not_set_up" };

// The latest version sent, and the one before it to say what changed.
const shown = {
  creator: { select: { name: true } },
  versions: { orderBy: { number: "desc" }, take: 2 },
  notes: inOrder,
} as const;

type Row = Prisma.DealGetPayload<{ include: typeof shown }>;

export type Brand = ReturnType<typeof createBrand>;

export function createBrand(deps: {
  prisma: PrismaClient;
  now: () => Date;
  /** The money path, which an agreement opens each post's money in. Without it nothing can be agreed. */
  money?: Pick<Money, "openAgreed">;
}) {
  const { prisma, now, money } = deps;

  function dealOf(deal: Row): BrandDeal | undefined {
    const [version, before] = deal.versions;
    if (!version) return undefined;
    const sent = version.terms as unknown as TermsSnapshot;
    const changed = whatChanged(before?.terms as unknown as TermsSnapshot | undefined, sent);

    return {
      dealId: deal.id,
      creatorName: deal.creator.name,
      brandName: deal.brandName,
      // While the creator answers the brand's notes, changes are asked, whichever page the creator is on.
      step: deal.revising ? "changes_requested" : (deal.step as BrandDeal["step"]),
      version: version.number,
      ...(deal.agreedAt ? { agreedAt: deal.agreedAt.toISOString() } : {}),
      posts: sent.posts.map((post) => ({
        deliverableId: post.deliverableId,
        platform: post.platform as Platform,
        amount: decimal(post.amountCents),
        deadlineDays: post.deadlineDays,
        ...(changed.posts[post.deliverableId] ? { changed: changed.posts[post.deliverableId] } : {}),
        hold: { state: "not_started" },
      })),
      items: sent.items.map((item) => ({
        id: item.id,
        deliverableId: item.deliverableId,
        name: item.name,
        ...(item.briefLine === undefined ? {} : { briefLine: item.briefLine }),
        addedByCreator: item.source === "creator",
        ...(changed.items.includes(item.id) ? { changed: true } : {}),
      })),
      brief: (deal.briefLines ?? []) as unknown as BriefLine[],
      answers: sent.answers as BrandDeal["answers"],
      notes: deal.notes.map(noteOf),
    };
  }

  /** Whether what a note is about is in the version the brand was shown, or in the brief. */
  function isInDeal(about: NoteAbout, sent: TermsSnapshot, brief: BriefLine[]): boolean {
    switch (about.kind) {
      case "item":
        return sent.items.some((item) => item.id === about.itemId);
      case "line":
        return brief.some((line) => line.number === about.briefLine);
      case "amount":
      case "deadline":
        return sent.posts.some((post) => post.deliverableId === about.deliverableId);
      case "deal":
        return true;
    }
  }

  return {
    async deal(dealId: string): Promise<BrandDeal | undefined> {
      const deal = await prisma.deal.findUnique({ where: { id: dealId }, include: shown });
      return deal ? dealOf(deal) : undefined;
    },

    /**
     * The brand asks for changes: a set of notes sent together (DS-FR-38). The deal moves to changes
     * requested, where the creator can edit again. The notes themselves change nothing (DS-BR-04, DS-BR-09).
     */
    async sendNotes(dealId: string, notes: { about: NoteAbout; text: string }[]): Promise<BrandDeal | NotesRefused | undefined> {
      return prisma.$transaction(async (tx) => {
        // One at a time for a deal, so two people with the link cannot both move it.
        await tx.$queryRaw`SELECT 1 FROM "Deal" WHERE "id" = ${dealId} FOR UPDATE`;
        const deal = await tx.deal.findUnique({ where: { id: dealId }, include: shown });
        const version = deal?.versions[0];
        if (!deal || !version) return undefined;
        if (deal.step !== "waiting_for_brand") return { refused: "not_waiting_for_brand" };

        const sent = version.terms as unknown as TermsSnapshot;
        const brief = (deal.briefLines ?? []) as unknown as BriefLine[];
        const unknown = notes.findIndex((note) => !isInDeal(note.about, sent, brief));
        if (unknown !== -1) return { refused: "unknown_subject", index: unknown };

        const at = now();
        const first = Math.max(-1, ...deal.notes.map((note) => note.position)) + 1;
        await tx.note.createMany({
          data: notes.map((note, index) => ({
            dealId,
            kind: note.about.kind,
            itemId: note.about.kind === "item" ? note.about.itemId : null,
            briefLine: note.about.kind === "line" ? note.about.briefLine : null,
            deliverableId: note.about.kind === "amount" || note.about.kind === "deadline" ? note.about.deliverableId : null,
            text: note.text,
            version: version.number,
            position: first + index,
            createdAt: at,
          })),
        });
        await tx.deal.update({ where: { id: dealId }, data: { step: "changes_requested", revising: true } });
        return dealOf(await tx.deal.findUniqueOrThrow({ where: { id: dealId }, include: shown }));
      });
    },

    /**
     * The brand agrees to the version it was shown (DS-FR-41). The agreement, and the opening of each
     * post's money with what that version says, happen together or not at all (DS-FR-42). From then
     * the terms are final. Nothing is asked of PayPal here: each hold is the brand's next step.
     */
    async agree(dealId: string, versionShown: number): Promise<BrandDeal | AgreeRefused | undefined> {
      if (!money) return { refused: "not_set_up" };
      return prisma.$transaction(async (tx) => {
        // One at a time for a deal, so two people with the link cannot both agree.
        await tx.$queryRaw`SELECT 1 FROM "Deal" WHERE "id" = ${dealId} FOR UPDATE`;
        const deal = await tx.deal.findUnique({ where: { id: dealId }, include: shown });
        const version = deal?.versions[0];
        if (!deal || !version) return undefined;
        if (deal.step === "agreed") return { refused: "already_agreed" };
        if (deal.step !== "waiting_for_brand") return { refused: "not_waiting_for_brand" };
        if (versionShown !== version.number) return { refused: "out_of_date" };

        // Where the creator is paid, read only to hand to the money path. It is never returned (DS-BR-13).
        const { paypalEmail } = await tx.creator.findUniqueOrThrow({ where: { id: deal.creatorId }, select: { paypalEmail: true } });
        if (!paypalEmail || !deal.timezone) throw new Error("A deal sent to its brand has no PayPal email or no timezone");

        const at = now();
        const sent = version.terms as unknown as TermsSnapshot;
        for (const post of sent.posts) {
          await money.openAgreed(
            tx,
            {
              deliverableId: post.deliverableId,
              amountCents: post.amountCents,
              deadlineDays: post.deadlineDays,
              creatorTimeZone: deal.timezone,
              payoutEmail: paypalEmail,
            },
            at,
          );
        }
        await tx.deal.update({ where: { id: dealId }, data: { step: "agreed", agreedAt: at, agreedVersion: version.number } });
        return dealOf(await tx.deal.findUniqueOrThrow({ where: { id: dealId }, include: shown }));
      });
    },
  };
}
