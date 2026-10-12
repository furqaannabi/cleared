/**
 * Taking an account away from Cleared (account and history spec AH-FR-10 to AH-FR-14): disconnecting
 * YouTube or Instagram. It is refused while a post on that platform is under way. Otherwise Cleared's
 * own copy of the access is deleted first, always, and only then is Google asked to revoke it, so a
 * failure at Google can never keep it (AH-BR-06;
 * docs/decisions/2026-10-12-disconnecting-deletes-then-revokes-at-google.md). Instagram has no call to
 * revoke: its token is deleted and ends on its own. A token is never logged or returned.
 */
import type { PrismaClient } from "../generated/prisma/client";
import type { GooglePort } from "../google/port";
import type { Secrets } from "../secrets/secrets";
import { accountOf, postsUnderWay, type AccountPlatform, type PostUnderWay } from "./under-way";

export type DisconnectRefused = { refused: "post_under_way"; blocking: PostUnderWay[] };

export type AccountRemoval = ReturnType<typeof createAccountRemoval>;

export function createAccountRemoval(deps: {
  prisma: PrismaClient;
  /** Asked to revoke a YouTube connection's access once it is deleted here. Without it nothing is asked. */
  google?: Pick<GooglePort, "revoke">;
  /** Decrypts the stored access so it can be handed back to Google to revoke. */
  secrets?: Secrets;
  /** Told what happened, with ids and the platform only. */
  log?: (message: string, details: Record<string, unknown>) => void;
}) {
  const { prisma, google, secrets, log } = deps;

  return {
    /**
     * Disconnects one of the creator's accounts (AH-FR-10). Asked for one that is not connected, it
     * changes nothing and says so.
     */
    async disconnect(creatorId: string, platform: AccountPlatform): Promise<{ disconnected: boolean } | DisconnectRefused> {
      const blocking = (await postsUnderWay(prisma, creatorId)).filter((post) => accountOf(post.platform) === platform);
      if (blocking.length > 0) return { refused: "post_under_way", blocking };

      const account = await prisma.connectedAccount.findUnique({ where: { creatorId_platform: { creatorId, platform } } });
      if (!account) return { disconnected: false };
      await prisma.connectedAccount.delete({ where: { id: account.id } });
      log?.("An account was disconnected", { creatorId, platform });

      // Cleared's copy is gone. Google is now asked, once, to withdraw what it gave (AH-FR-13).
      if (platform === "youtube" && google && secrets && account.refreshTokenEncrypted) {
        let token: string | undefined;
        try {
          token = await secrets.decrypt(account.refreshTokenEncrypted);
        } catch {
          // Stored under a key that is gone. There is nothing to hand back.
        }
        const revoked = token ? await google.revoke(token).catch(() => false) : false;
        log?.("Google was asked to revoke a disconnected account's access", { creatorId, revoked });
      }
      return { disconnected: true };
    },
  };
}
