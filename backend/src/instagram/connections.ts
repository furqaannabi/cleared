/**
 * A creator's Instagram connection (Instagram Reels spec IG-FR-04, IG-FR-06): storing the account with
 * its token encrypted, and keeping that token alive. A token lasts 60 days and can be renewed while it
 * still works, so a daily job renews every one more than 7 days old. One that cannot be renewed is
 * lost access: it is removed, and the creator connects again. A token is never logged or returned
 * (IG-BR-02).
 */
import type { PrismaClient } from "../generated/prisma/client";
import { enqueue, type JobHandlers } from "../jobs/jobs";
import type { Secrets } from "../secrets/secrets";
import type { InstagramAccount, InstagramPort, InstagramToken } from "./port";

const DAY_MS = 24 * 3600 * 1000;
/** How long a token lasts from when Instagram gives it. */
const TOKEN_DAYS = 60;
const RENEW_JOB = "instagram_renew";

export type InstagramConnections = ReturnType<typeof createInstagramConnections>;

export function createInstagramConnections(deps: {
  prisma: PrismaClient;
  now: () => Date;
  instagram: Pick<InstagramPort, "renew">;
  secrets: Secrets;
  /** How old a token is before it is renewed, in days (IG-FR-06). */
  renewAfterDays?: number;
  /** Told once a creator's account is stored, so a live check that stopped for lost access can start again (IG-FR-27). */
  onConnected?: (creatorId: string) => Promise<void>;
  /** Told how a renewal went, with ids and counts only. */
  log?: (message: string, details: Record<string, unknown>) => void;
}) {
  const { prisma, now, instagram, secrets, log } = deps;
  const renewAfterDays = deps.renewAfterDays ?? 7;

  const handlers: JobHandlers = {
    /**
     * The daily renewal. A token more than the set days old has under (60 less that) days left. Each
     * account is renewed on its own: one that fails does not hold up the rest. The job always comes
     * back the next day.
     */
    async [RENEW_JOB]() {
      const at = now();
      const due = await prisma.connectedAccount.findMany({
        where: { platform: "instagram", refreshTokenEncrypted: { not: null }, tokenExpiresAt: { lt: new Date(at.getTime() + (TOKEN_DAYS - renewAfterDays) * DAY_MS) } },
      });
      let renewed = 0;
      let lost = 0;
      let failed = 0;
      for (const account of due) {
        try {
          const answer = await instagram.renew(await secrets.decrypt(account.refreshTokenEncrypted!));
          if (answer === "no_access") {
            // Revoked or expired. There is no access left to keep: the creator connects again.
            await prisma.connectedAccount.update({ where: { id: account.id }, data: { refreshTokenEncrypted: null, tokenExpiresAt: null } });
            lost++;
          } else {
            await prisma.connectedAccount.update({ where: { id: account.id }, data: { refreshTokenEncrypted: await secrets.encrypt(answer.token), tokenExpiresAt: answer.expiresAt } });
            renewed++;
          }
        } catch {
          // Instagram failed, or the token was stored under a key that is gone. It is tried again tomorrow.
          failed++;
        }
      }
      if (due.length > 0) log?.("Instagram tokens were renewed", { due: due.length, renewed, lost, failed });
      return { retryAt: new Date(at.getTime() + DAY_MS) };
    },
  };

  return {
    handlers,

    /** Stores the account a creator connected, replacing any Instagram account they had (IG-FR-04). The token is encrypted here. */
    async store(creatorId: string, account: InstagramAccount, token: InstagramToken): Promise<void> {
      const stored = { externalId: account.id, name: account.username, refreshTokenEncrypted: await secrets.encrypt(token.token), tokenExpiresAt: token.expiresAt, connectedAt: now() };
      await prisma.connectedAccount.upsert({
        where: { creatorId_platform: { creatorId, platform: "instagram" } },
        create: { creatorId, platform: "instagram", ...stored },
        update: stored,
      });
      await deps.onConnected?.(creatorId);
    },

    /** Makes sure the daily renewal is waiting to run. Called when the service starts; calling it again changes nothing. */
    async scheduleRenewals(): Promise<void> {
      await prisma.$transaction(async (tx) => {
        // One at a time, so two services starting together make one job.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${RENEW_JOB}))`;
        if ((await tx.job.count({ where: { name: RENEW_JOB, status: { in: ["pending", "running"] } } })) > 0) return;
        await enqueue(tx, { name: RENEW_JOB, payload: {}, runAt: now() });
      });
    },
  };
}
