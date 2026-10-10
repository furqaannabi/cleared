/**
 * Rulings by a person at Cleared (publish to paid spec PT-FR-34, PT-FR-35;
 * docs/decisions/2026-10-10-a-ruling-is-a-command-not-a-page.md). When a brand objects to a live post
 * the check could not decide, a named person rules: pay, or release. This module lists what is waiting
 * and records a ruling with who made it. It is reached only from a command run by someone with access
 * to the service: there is no route, so nothing a visitor can reach pays or releases on a person's say
 * (PT-BR-14). The money path alone acts on a ruling, and may refuse it (PT-BR-01).
 */
import type { PrismaClient } from "../generated/prisma/client";
import type { TermsSnapshot } from "../invites/terms";
import type { Money, MoneyRefusal } from "../money/money";

/** One post waiting for a ruling. The objection and the evidence are untrusted text, shown as text (PT-BR-10). */
export interface Waiting {
  deliverableId: string;
  dealId: string;
  brandName: string;
  creatorName: string;
  platform: string;
  /** The amount held, as a decimal string. */
  amount: string;
  /** The brand's reason, in its own words. */
  objection: string;
  /** Day 28 of the hold: with no ruling by then, the money path releases it. */
  ruleBy?: Date;
  postUrl?: string;
  /** What the last finished live check found. */
  liveCheck?: { answer: string | null; undecided: string[]; items: { name: string; result: string; evidence?: string }[] };
}

const NAME_MAX = 120;

/** Text with nothing in it that a terminal would act on: control characters become spaces. */
const plain = (text: string) => text.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").trim();

/** The list as a person reads it in a terminal. */
export function printed(waiting: Waiting[]): string {
  if (waiting.length === 0) return "Nothing is waiting for a ruling.";
  return waiting
    .map((post) =>
      [
        `${plain(post.creatorName)} for ${plain(post.brandName)} (${post.platform}), $${post.amount} held`,
        `  post:      ${post.deliverableId}   deal: ${post.dealId}`,
        `  rule by:   ${post.ruleBy ? post.ruleBy.toISOString() : "unknown"}   (with no ruling, the hold is released then)`,
        ...(post.postUrl ? [`  live post: ${post.postUrl}`] : []),
        `  the brand objected: "${plain(post.objection)}"`,
        ...(post.liveCheck
          ? [
              `  live check: ${post.liveCheck.answer ?? "none finished"}${post.liveCheck.undecided.length ? `, could not decide: ${post.liveCheck.undecided.join(", ")}` : ""}`,
              ...post.liveCheck.items.map((item) => `    ${item.result.padEnd(10)} ${plain(item.name)}${item.evidence ? `  ("${plain(item.evidence)}")` : ""}`),
            ]
          : []),
      ].join("\n"),
    )
    .join("\n\n");
}

export type Rulings = ReturnType<typeof createRulings>;

export function createRulings(deps: { prisma: PrismaClient; now: () => Date; money: Pick<Money, "view" | "clearedRuled"> }) {
  const { prisma, now, money } = deps;

  return {
    /** Every post waiting for a person at Cleared to rule, the one due soonest first (PT-FR-34). */
    async list(): Promise<Waiting[]> {
      const held = await prisma.deliverableMoney.findMany({ where: { stage: "held" }, select: { deliverableId: true } });
      const waiting: Waiting[] = [];
      for (const { deliverableId } of held) {
        const view = await money.view(deliverableId);
        if (view?.waitingOn?.for !== "cleared_to_rule") continue;
        const post = await prisma.deliverable.findUnique({ where: { id: deliverableId }, include: { deal: { include: { creator: { select: { name: true } } } } } });
        if (!post) continue;
        const [video, check, results, version] = await Promise.all([
          prisma.postVideo.findUnique({ where: { deliverableId } }),
          prisma.liveCheck.findUnique({ where: { deliverableId } }),
          prisma.liveCheckItem.findMany({ where: { deliverableId }, orderBy: { position: "asc" } }),
          prisma.termsVersion.findFirst({ where: { dealId: post.dealId, number: post.deal.agreedVersion ?? -1 } }),
        ]);
        const names = new Map(((version?.terms as unknown as TermsSnapshot | undefined)?.items ?? []).map((item) => [item.id, item.name]));
        waiting.push({
          deliverableId,
          dealId: post.dealId,
          brandName: post.deal.brandName,
          creatorName: post.deal.creator.name,
          platform: post.platform,
          amount: view.amounts.amount,
          objection: view.waitingOn.objection,
          ...(view.hold.state === "held" ? { ruleBy: view.hold.day28At } : {}),
          ...(video ? { postUrl: `https://www.youtube.com/watch?v=${video.videoId}` } : {}),
          ...(check
            ? {
                liveCheck: {
                  answer: check.answer,
                  undecided: Array.isArray(check.undecided) ? check.undecided.filter((what): what is string => typeof what === "string") : [],
                  items: results.map((item) => {
                    const evidence = (item.evidence as { text?: unknown } | null)?.text;
                    return { name: names.get(item.itemId) ?? item.itemId, result: item.result, ...(typeof evidence === "string" ? { evidence } : {}) };
                  }),
                },
              }
            : {}),
        });
      }
      return waiting.sort((a, b) => (a.ruleBy?.getTime() ?? 0) - (b.ruleBy?.getTime() ?? 0));
    },

    /**
     * Records one ruling with the name of who made it, and passes it to the money path (PT-FR-35,
     * MP-FR-19). The name is kept first, so a ruling is never acted on without one; if the money path
     * refuses, nothing was ruled and the record is taken back.
     */
    async rule(deliverableId: string, decision: "pay" | "release", by: string): Promise<{ ok: true } | { ok: false; reason: "name_needed" | MoneyRefusal }> {
      const name = plain(by);
      if (!name || name.length > NAME_MAX) return { ok: false, reason: "name_needed" };
      const view = await money.view(deliverableId);
      if (!view) return { ok: false, reason: "unknown_deliverable" };
      // Nothing is waiting on a ruling here: the money path says why, and no record is touched, so an earlier ruling's stays.
      if (view.waitingOn?.for !== "cleared_to_rule") {
        const refused = await money.clearedRuled(deliverableId, decision);
        return refused.ok ? { ok: true } : { ok: false, reason: refused.reason };
      }
      const kept = { decision, by: name, at: now() };
      await prisma.ruling.upsert({ where: { deliverableId }, create: { deliverableId, ...kept }, update: kept });
      const ruled = await money.clearedRuled(deliverableId, decision);
      if (ruled.ok) return { ok: true };
      await prisma.ruling.delete({ where: { deliverableId } });
      return { ok: false, reason: ruled.reason };
    },
  };
}
