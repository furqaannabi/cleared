/**
 * The invite: a deal's terms, the brand's email and the brand's link (deal set-up spec DS-FR-29 to
 * DS-FR-33). Every function takes the creator who is asking, and a deal that is not theirs is treated
 * exactly as one that does not exist (DS-BR-01).
 */
import type { CancelField, Cancelled, Cancelling } from "../cancel/cancelling";
import type { Platform, Step } from "../deals/deals";
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import type { Money } from "../money/money";
import { defaultSettings as moneySettings } from "../money/types";
import { decimal } from "../money/view";
import { holdOf, type DealHold } from "./hold";
import { freshLink, hashToken, type LinkKeys } from "./link-keys";
import { inOrder, noteOf, type DealNote } from "./notes";
import { takeSnapshot } from "./terms";

/** A deal at the invite step or after it, in the shape the creator's page expects. */
export interface Invite {
  dealId: string;
  brandName: string;
  step: Exclude<Step, "checklist">;
  posts: {
    deliverableId: string;
    platform: Platform;
    /** How many checklist items the post has. */
    itemCount: number;
    /** US dollars, as a decimal string with two places (DS-BR-12). */
    amount?: string;
    /** How many days after the hold the post is due. */
    deadlineDays?: number;
    /** The post's hold as the money path has it, once the brand has agreed (DS-FR-46). */
    hold?: DealHold;
    /** Whether the post can be cancelled now, or why not; and who cancelled it (PT-FR-31, PT-FR-32). */
    cancel?: CancelField;
    cancelled?: Cancelled;
  }[];
  /** The brand's email, if the creator gave one. Nothing is sent to it (DS-FR-30). */
  brandEmail?: string;
  /** The number of the version the brand has, once it has been sent one (DS-FR-31). */
  version?: number;
  /** The brand's link, while there is one. For the deal's creator only (DS-FR-32, DS-BR-11). */
  link?: { url: string; expiresAt: string; expired: boolean };
  /** The brand's notes, once it has asked for changes, each with the creator's reply (DS-FR-38, DS-FR-39). */
  notes?: DealNote[];
}

export interface InviteSettings {
  /** The least and the most one post's amount can be, in cents: the money path's limits on a hold (MP-FR-09). */
  minAmountCents: number;
  maxAmountCents: number;
  /** How long a link works for (DS-FR-31). */
  linkDays: number;
}

export const defaultInviteSettings: InviteSettings = {
  minAmountCents: moneySettings.minAmountCents,
  maxAmountCents: moneySettings.maxAmountCents,
  linkDays: 7,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Why a change to the terms was refused. */
export type TermsRefused =
  | { refused: "not_found" }
  /** The terms cannot be changed now: the brand has the link, or the deal has moved on. */
  | { refused: "not_editable" }
  | { refused: "amount_below_minimum" | "amount_above_maximum" };

/** Why making, replacing or turning off the brand's link was refused. */
export type LinkRefused =
  | { refused: "not_found" }
  /** A link is made from the invite step only. */
  | { refused: "not_at_invite" }
  /** A post has no amount or no deadline yet. `index` is its place among the deal's posts. */
  | { refused: "terms_incomplete"; index: number }
  | { refused: "youtube_not_connected" | "paypal_email_missing" }
  /** The brand has no link to replace or turn off: none is made yet, or the deal has moved on. */
  | { refused: "no_link" }
  /** Updated terms are sent in answer to the brand's notes, and there are none to answer. */
  | { refused: "no_changes_asked" }
  /** The service has no key to work links out from, so it makes none. */
  | { refused: "not_set_up" };

const whole = {
  deliverables: { orderBy: { position: "asc" } },
  items: { orderBy: { position: "asc" } },
  questions: { orderBy: { position: "asc" } },
  // The deal's own invite link that is on, if there is one, and the latest version sent. A review link
  // is for one post's draft and is not shown here (DR-FR-44).
  links: { where: { turnedOffAt: null, deliverableId: null }, orderBy: { createdAt: "desc" }, take: 1 },
  versions: { orderBy: { number: "desc" }, take: 1 },
  notes: inOrder,
} as const;

type Row = Prisma.DealGetPayload<{ include: typeof whole }>;

export type Invites = ReturnType<typeof createInvites>;

export function createInvites(deps: {
  prisma: PrismaClient;
  now: () => Date;
  /** The address of Cleared's own app, which a link opens. */
  appOrigin: string;
  /** Works out a link's token from its salt. Without it no link is made or shown. */
  linkKeys?: LinkKeys;
  /** The money path, read to show each agreed post's hold. */
  money?: Pick<Money, "view">;
  /** Whether each post can be cancelled, and who cancelled it (PT-FR-31, PT-FR-32). */
  cancels?: Cancelling["describe"];
  settings?: InviteSettings;
}) {
  const { prisma, now, appOrigin, linkKeys, money } = deps;
  const settings = deps.settings ?? defaultInviteSettings;

  /** The link as its creator sees it. The token is worked out again each time; it is stored nowhere (DS-FR-32). */
  async function linkOf(deal: Row): Promise<Invite["link"]> {
    const link = deal.links[0];
    if (!link || !linkKeys) return undefined;
    return {
      url: `${appOrigin}/b/${await linkKeys.token(link.salt)}`,
      expiresAt: link.expiresAt.toISOString(),
      expired: link.expiresAt <= now(),
    };
  }

  const termsOf = (deal: Row): Invite => ({
    dealId: deal.id,
    brandName: deal.brandName,
    step: deal.step as Invite["step"],
    posts: deal.deliverables.map((post) => ({
      deliverableId: post.id,
      platform: post.platform as Platform,
      itemCount: deal.items.filter((item) => item.deliverableId === post.id).length,
      ...(post.amountCents === null ? {} : { amount: decimal(post.amountCents) }),
      ...(post.deadlineDays === null ? {} : { deadlineDays: post.deadlineDays }),
    })),
    ...(deal.brandEmail === null ? {} : { brandEmail: deal.brandEmail }),
  });

  const inviteOf = async (deal: Row): Promise<Invite> => {
    const link = await linkOf(deal);
    const version = deal.step === "invite" ? undefined : deal.versions[0]?.number;
    const terms = termsOf(deal);
    if (deal.step === "agreed") {
      for (const post of terms.posts) post.hold = holdOf((await money?.view(post.deliverableId))?.hold, deal.timezone);
    }
    const cancels = await deps.cancels?.(terms.posts.map((post) => post.deliverableId));
    for (const post of terms.posts) Object.assign(post, cancels?.get(post.deliverableId) ?? {});
    return {
      ...terms,
      ...(version === undefined ? {} : { version }),
      ...(link ? { link } : {}),
      ...(deal.notes.length ? { notes: deal.notes.map(noteOf) } : {}),
    };
  };

  /** The creator's deal, if it has an invite: one still at the checklist step has none. */
  const find = async (db: Prisma.TransactionClient | PrismaClient, creatorId: string, dealId: string) => {
    const deal = await db.deal.findFirst({ where: { id: dealId, creatorId }, include: whole });
    return deal && deal.step !== "checklist" ? deal : undefined;
  };

  /** Records a link for the deal, good for the days in the settings from `at`. */
  const saveLink = (tx: Prisma.TransactionClient, dealId: string, link: { salt: string; tokenHash: string }, at: Date) =>
    tx.inviteLink.create({
      data: { dealId, ...link, createdAt: at, expiresAt: new Date(at.getTime() + settings.linkDays * DAY_MS) },
    });

  /**
   * Turns off every link the deal has, and ends every brand session made from them. A link turned off
   * never works again (DS-FR-33).
   */
  async function turnOff(tx: Prisma.TransactionClient, dealId: string, at: Date) {
    // The deal's invite link only. A review link has its own life (DR-FR-45).
    await tx.inviteLink.updateMany({ where: { dealId, deliverableId: null, turnedOffAt: null }, data: { turnedOffAt: at } });
    await tx.session.deleteMany({ where: { link: { dealId, deliverableId: null } } });
  }

  /** Why the terms cannot go to the brand yet, if they cannot: the same for a first link and for updated terms. */
  async function notSendable(tx: Prisma.TransactionClient, deal: Row): Promise<LinkRefused | undefined> {
    // A cancelled post is not sent to the brand, so it needs no terms (PT-FR-30). A deal with no post left has nothing to send.
    const gone = await cancelledIn(tx, deal);
    if (gone.size === deal.deliverables.length) return { refused: "not_at_invite" };
    const unfinished = deal.deliverables.findIndex((post) => !gone.has(post.id) && (post.amountCents === null || post.deadlineDays === null));
    if (unfinished !== -1) return { refused: "terms_incomplete", index: unfinished };
    const creator = await tx.creator.findUniqueOrThrow({ where: { id: deal.creatorId }, include: { accounts: true } });
    if (!creator.accounts.some((account) => account.platform === "youtube")) return { refused: "youtube_not_connected" };
    if (!creator.paypalEmail) return { refused: "paypal_email_missing" };
    return undefined;
  }

  /** The posts of a deal that were cancelled before the brand agreed. */
  const cancelledIn = async (tx: Prisma.TransactionClient, deal: Row) =>
    new Set((await tx.postCancel.findMany({ where: { deliverableId: { in: deal.deliverables.map((post) => post.id) } }, select: { deliverableId: true } })).map((row) => row.deliverableId));

  /** Saves the terms and the checklist as they stand as the deal's next version. A post already cancelled is left out of it. */
  const saveVersion = async (tx: Prisma.TransactionClient, deal: Row, at: Date) => {
    const gone = await cancelledIn(tx, deal);
    const left = { ...deal, deliverables: deal.deliverables.filter((post) => !gone.has(post.id)), items: deal.items.filter((item) => !gone.has(item.deliverableId)) };
    return tx.termsVersion.create({
      data: {
        dealId: deal.id,
        number: (deal.versions[0]?.number ?? 0) + 1,
        terms: takeSnapshot(left) as unknown as Prisma.InputJsonValue,
        createdAt: at,
      },
    });
  };

  /** Holds the deal's row until the transaction ends, so two changes to one invite happen one after the other. */
  const lock = (tx: Prisma.TransactionClient, dealId: string) => tx.$queryRaw`SELECT 1 FROM "Deal" WHERE "id" = ${dealId} FOR UPDATE`;

  /**
   * Makes one change to a deal's terms, in a transaction, if the deal is this creator's and its terms
   * can be edited now. Returns the invite as it then stands.
   */
  async function editTerms(
    creatorId: string,
    dealId: string,
    change: (tx: Prisma.TransactionClient, deal: Row) => Promise<TermsRefused | void>,
  ): Promise<Invite | TermsRefused> {
    return prisma.$transaction(async (tx) => {
      await lock(tx, dealId);
      const deal = await find(tx, creatorId, dealId);
      if (!deal) return { refused: "not_found" };
      // Before the brand has the link, or while answering the changes it asked for (DS-FR-39).
      if (deal.step !== "invite" && deal.step !== "changes_requested") return { refused: "not_editable" };
      const refused = await change(tx, deal);
      if (refused) return refused;
      return inviteOf(await tx.deal.findUniqueOrThrow({ where: { id: dealId }, include: whole }));
    });
  }

  return {
    /** The deal's invite, if the deal is this creator's and has reached the invite step. */
    async get(creatorId: string, dealId: string): Promise<Invite | undefined> {
      const deal = await find(prisma, creatorId, dealId);
      return deal ? inviteOf(deal) : undefined;
    },

    /**
     * Sets a post's amount, its deadline, or both (DS-FR-29). The amount is in whole cents and must be
     * one a hold can be made for (MP-FR-09).
     */
    setPostTerms(creatorId: string, dealId: string, deliverableId: string, terms: { amountCents?: number; deadlineDays?: number }) {
      return editTerms(creatorId, dealId, async (tx, deal) => {
        if (!deal.deliverables.some((post) => post.id === deliverableId)) return { refused: "not_found" };
        if (terms.amountCents !== undefined) {
          if (terms.amountCents < settings.minAmountCents) return { refused: "amount_below_minimum" };
          if (terms.amountCents > settings.maxAmountCents) return { refused: "amount_above_maximum" };
        }
        await tx.deliverable.update({ where: { id: deliverableId }, data: terms });
      });
    },

    /** Keeps the brand's email, or takes it away (DS-FR-30). It is only kept: nothing is sent to it. */
    setBrandEmail(creatorId: string, dealId: string, brandEmail: string | null) {
      return editTerms(creatorId, dealId, async (tx) => {
        await tx.deal.update({ where: { id: dealId }, data: { brandEmail } });
      });
    },

    /**
     * Makes the brand's link (DS-FR-31). The terms and the checklist are saved as a version, the link
     * and the creator's timezone are recorded, and the deal waits for the brand, all together or not at all.
     */
    async createLink(creatorId: string, dealId: string, timezone: string): Promise<Invite | LinkRefused> {
      if (!linkKeys) return { refused: "not_set_up" };
      const link = await freshLink(linkKeys);

      return prisma.$transaction(async (tx) => {
        await lock(tx, dealId);
        const deal = await find(tx, creatorId, dealId);
        if (!deal) return { refused: "not_found" };
        if (deal.step !== "invite") return { refused: "not_at_invite" };
        const notReady = await notSendable(tx, deal);
        if (notReady) return notReady;

        const at = now();
        await saveVersion(tx, deal, at);
        await saveLink(tx, dealId, link, at);
        await tx.deal.update({ where: { id: dealId }, data: { step: "waiting_for_brand", timezone } });
        return inviteOf(await tx.deal.findUniqueOrThrow({ where: { id: dealId }, include: whole }));
      });
    },

    /** The creator's reply to one of the brand's notes, while its changes are being answered (DS-FR-39). */
    async replyToNote(creatorId: string, dealId: string, noteId: string, reply: string): Promise<Invite | TermsRefused> {
      return prisma.$transaction(async (tx) => {
        await lock(tx, dealId);
        const deal = await find(tx, creatorId, dealId);
        // A note that is not this deal's is not there at all, whatever step the deal is at.
        if (!deal || !deal.notes.some((note) => note.id === noteId)) return { refused: "not_found" };
        if (deal.step !== "changes_requested") return { refused: "not_editable" };
        await tx.note.update({ where: { id: noteId }, data: { reply } });
        return inviteOf(await tx.deal.findUniqueOrThrow({ where: { id: dealId }, include: whole }));
      });
    },

    /**
     * "Send updated terms" (DS-FR-40): the terms and the checklist are saved as a new version, the deal
     * waits for the brand again, and the same link gets 7 more days from now.
     */
    async sendUpdatedTerms(creatorId: string, dealId: string): Promise<Invite | LinkRefused> {
      return prisma.$transaction(async (tx) => {
        await lock(tx, dealId);
        const deal = await find(tx, creatorId, dealId);
        if (!deal) return { refused: "not_found" };
        if (deal.step !== "changes_requested") return { refused: "no_changes_asked" };
        const notReady = await notSendable(tx, deal);
        if (notReady) return notReady;

        const at = now();
        await saveVersion(tx, deal, at);
        await tx.inviteLink.updateMany({
          where: { dealId, deliverableId: null, turnedOffAt: null },
          data: { expiresAt: new Date(at.getTime() + settings.linkDays * DAY_MS) },
        });
        await tx.deal.update({ where: { id: dealId }, data: { step: "waiting_for_brand", revising: false } });
        return inviteOf(await tx.deal.findUniqueOrThrow({ where: { id: dealId }, include: whole }));
      });
    },

    /**
     * The link a token is for, if it is on and has not expired (DS-FR-34). Looked up by the token's
     * hash. An unknown, an expired and a turned-off link are all simply not there (DS-FR-35).
     */
    async openLink(token: string): Promise<{ id: string; dealId: string; expiresAt: Date; deliverableId?: string } | undefined> {
      const link = await prisma.inviteLink.findUnique({ where: { tokenHash: hashToken(token) } });
      // A review link that is closed opens nothing new, though sessions made from it earlier go on (DR-FR-45).
      if (!link || link.turnedOffAt !== null || link.closedAt !== null || link.expiresAt <= now()) return undefined;
      return { id: link.id, dealId: link.dealId, expiresAt: link.expiresAt, ...(link.deliverableId ? { deliverableId: link.deliverableId } : {}) };
    },

    /**
     * "Make a new link" (DS-FR-33): the old link is turned off and a new one takes its place, with its
     * own 7 days. The terms and their version stay as they are.
     */
    async renewLink(creatorId: string, dealId: string): Promise<Invite | LinkRefused> {
      if (!linkKeys) return { refused: "not_set_up" };
      const link = await freshLink(linkKeys);

      return prisma.$transaction(async (tx) => {
        await lock(tx, dealId);
        const deal = await find(tx, creatorId, dealId);
        if (!deal) return { refused: "not_found" };
        // Whenever the brand has a link: also while changes are asked, and after it has agreed.
        if (deal.step === "invite") return { refused: "no_link" };
        const at = now();
        await turnOff(tx, dealId, at);
        await saveLink(tx, dealId, link, at);
        return inviteOf(await tx.deal.findUniqueOrThrow({ where: { id: dealId }, include: whole }));
      });
    },

    /**
     * "Change terms" (DS-FR-33): the link is turned off and the deal goes back to the invite step, where
     * the terms and the checklist can be edited again. The next link is a new one.
     */
    async turnOffLink(creatorId: string, dealId: string): Promise<Invite | LinkRefused> {
      return prisma.$transaction(async (tx) => {
        await lock(tx, dealId);
        const deal = await find(tx, creatorId, dealId);
        if (!deal) return { refused: "not_found" };
        if (deal.step !== "waiting_for_brand") return { refused: "no_link" };
        await turnOff(tx, dealId, now());
        return inviteOf(await tx.deal.update({ where: { id: dealId }, data: { step: "invite" }, include: whole }));
      });
    },
  };
}
