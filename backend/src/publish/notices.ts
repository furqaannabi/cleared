/**
 * Telling the brand that its decision on a live post is wanted (publish to paid spec PT-FR-20,
 * PT-FR-21). When either of its 48 hours starts, a fresh link to that post is made and one email
 * carries it: to the address the brand gave when it agreed, else the one the creator gave at the
 * invite, else none is sent and the creator's post carries the link. It is sent once for each window,
 * as a job. The address and the link are never logged (PT-BR-11, PT-BR-12).
 */
import type { Email } from "../email/port";
import type { PrismaClient } from "../generated/prisma/client";
import { enqueue, type JobHandlers } from "../jobs/jobs";
import type { ReviewLinks } from "../review/links";
import { noticeEmail } from "./notice-email";

export type Notices = ReturnType<typeof createNotices>;

export function createNotices(deps: {
  prisma: PrismaClient;
  now: () => Date;
  links: Pick<ReviewLinks, "make" | "addressToSend">;
  /** The email service. Without it nothing is sent, and the creator's post carries the link. */
  email?: Email;
  /** How many times a notice is tried before emailing is given up and the creator's post carries the link. */
  tries?: number;
  /** Told what happened to a notice, with ids only. */
  log?: (message: string, details: Record<string, unknown>) => void;
}) {
  const { prisma, now, links, email, log } = deps;
  const tries = deps.tries ?? 5;

  const handlers: JobHandlers = {
    /**
     * Sends one notice, once. A failure of the email service is thrown, so the job is tried again with
     * growing waits. After the last try emailing is given up, and the creator's post carries the link:
     * a brand must never go untold because a service was down.
     */
    async brand_notice(payload, { attempts }) {
      const noticeId = (payload as { noticeId?: unknown } | null)?.noticeId;
      if (typeof noticeId !== "string") throw new Error("A notice job is missing its noticeId");
      const notice = await prisma.brandNotice.findUnique({ where: { id: noticeId } });
      if (!notice || notice.sentTo !== null) return;
      const at = now();
      const none = () => prisma.brandNotice.update({ where: { id: noticeId }, data: { sentTo: "none" } });
      // The brand's time is already up: there is nothing left to tell it.
      if (at >= notice.endsAt) return void (await none());

      const post = await prisma.deliverable.findUnique({ where: { id: notice.deliverableId }, include: { deal: { include: { creator: { select: { name: true } } } } } });
      const link = await links.addressToSend(notice.deliverableId);
      const own = post?.deal.brandNoticeEmail;
      const to = own ?? post?.deal.brandEmail;
      if (!post || !email || !link || !to) {
        await none();
        return log?.("No notice was emailed to the brand: the creator's post carries the link", { deliverableId: notice.deliverableId, kind: notice.kind });
      }

      const check = notice.kind === "accept" ? await prisma.liveCheck.findUnique({ where: { deliverableId: notice.deliverableId } }) : null;
      const message = noticeEmail({
        kind: notice.kind === "accept" ? "accept" : "confirm",
        creatorName: post.deal.creator.name,
        brandName: post.deal.brandName,
        platform: post.platform,
        endsAt: notice.endsAt,
        timeZone: post.deal.timezone ?? "UTC",
        notFixable: check?.notFixable,
        link,
      });
      // The notice's own id is the key, so a retry after a lost answer is never a second email.
      try {
        await email.send({ to, ...message, idempotencyKey: `brand-notice-${notice.id}` });
      } catch (error) {
        if (attempts < tries) throw error;
        await none();
        return log?.("A notice could not be emailed to the brand: the creator's post carries the link", { deliverableId: notice.deliverableId, kind: notice.kind, tries: attempts });
      }
      await prisma.brandNotice.update({ where: { id: noticeId }, data: { sentTo: own ? "brand" : "creator_given", sentAt: at } });
      log?.("A notice was emailed to the brand", { deliverableId: notice.deliverableId, kind: notice.kind, to: own ? "brand" : "creator_given" });
    },
  };

  return {
    handlers,

    /**
     * One of the brand's 48 hours has started. The first time for that window, a fresh link to the post
     * is made and the notice is written with the job that sends it, together or not at all.
     */
    async windowStarted(deliverableId: string, kind: "confirm" | "accept", endsAt: Date): Promise<void> {
      const at = now();
      await prisma.$transaction(async (tx) => {
        // One at a time for a post, so a check that runs twice cannot make two notices.
        await tx.$queryRaw`SELECT 1 FROM "Deliverable" WHERE "id" = ${deliverableId} FOR UPDATE`;
        if (await tx.brandNotice.findUnique({ where: { deliverableId_kind: { deliverableId, kind } } })) return;
        await links.make(tx, deliverableId, at, { until: endsAt });
        const notice = await tx.brandNotice.create({ data: { deliverableId, kind, endsAt, createdAt: at } });
        await enqueue(tx, { name: "brand_notice", payload: { noticeId: notice.id }, runAt: at });
      });
    },
  };
}
