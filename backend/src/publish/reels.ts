/**
 * Publishing a Reel (Instagram Reels spec IG-FR-11 to IG-FR-13): the creator asks for the go-ahead.
 * Instagram has no unlisted upload, so there is nothing to look at before the Reel is public. What
 * Cleared can check is that it can still read the creator's account, so that a creator whose access
 * is gone is told before they post, not after. Only then is the money path asked, which alone decides
 * whether there is a go-ahead (IG-BR-03). Instagram is only ever read (IG-BR-01), and a token is
 * never logged or returned (IG-BR-02).
 */
import type { PrismaClient } from "../generated/prisma/client";
import type { InstagramPort } from "../instagram/port";
import type { Money, MoneyRefusal } from "../money/money";
import type { GoAheadView } from "../money/view";
import type { Secrets } from "../secrets/secrets";

export type ReelGoAheadRefused =
  | { refused: "not_found" }
  /** The Reel's draft is not approved, so there is nothing to post yet. */
  | { refused: "not_approved" }
  /** Cleared cannot read the creator's Instagram account: not connected, revoked, or expired (IG-FR-13). */
  | { refused: "reconnect_instagram" }
  /** Instagram itself failed. Nothing was decided; the creator tries again. */
  | { refused: "instagram_unavailable" }
  /** The money path refused, with its own reason (MP-FR-10). */
  | { refused: "money"; reason: MoneyRefusal };

export type ReelPublishing = ReturnType<typeof createReelPublishing>;

export function createReelPublishing(deps: {
  prisma: PrismaClient;
  instagram: Pick<InstagramPort, "account">;
  /** Decrypts a creator's stored access to Instagram. It is never logged or returned. */
  secrets: Secrets;
  money?: Pick<Money, "view" | "askGoAhead">;
}) {
  const { prisma, instagram, secrets, money } = deps;

  /** The creator's connected Instagram account and their stored access to it, if there is any that could work. */
  async function accountOf(creatorId: string): Promise<{ accountId: string; token: string } | undefined> {
    const account = await prisma.connectedAccount.findUnique({ where: { creatorId_platform: { creatorId, platform: "instagram" } } });
    if (!account?.refreshTokenEncrypted) return undefined;
    try {
      return { accountId: account.externalId, token: await secrets.decrypt(account.refreshTokenEncrypted) };
    } catch {
      // Stored under a key that is gone. There is no access to use.
      return undefined;
    }
  }

  return {
    /**
     * Asks for a Reel's go-ahead (IG-FR-11 to IG-FR-13). In order: the Reel and its approved draft,
     * the creator's account read from Instagram, and then the money path's own answer. PayPal is
     * asked nothing until the account has been read.
     */
    async askGoAhead(creatorId: string, deliverableId: string): Promise<{ goAhead: GoAheadView } | ReelGoAheadRefused> {
      const post = await prisma.deliverable.findFirst({ where: { id: deliverableId, platform: "instagram_reel", deal: { creatorId } } });
      if (!post) return { refused: "not_found" };
      const check = await prisma.draftCheck.findUnique({ where: { deliverableId } });
      if (!check?.approvedAt) return { refused: "not_approved" };
      // A hold that has been released or taken has no go-ahead to give. The money path says so before Instagram is asked.
      const stage = (await money?.view(deliverableId))?.stage;
      if (!money || stage !== "held") return { refused: "money", reason: "not_held" };

      const stored = await accountOf(creatorId);
      if (!stored) return { refused: "reconnect_instagram" };
      let account;
      try {
        account = await instagram.account(stored.token);
      } catch {
        return { refused: "instagram_unavailable" };
      }
      // The access must still work, and be for the account that was connected and no other.
      if (account === "no_access" || account.id !== stored.accountId) return { refused: "reconnect_instagram" };

      const asked = await money.askGoAhead(deliverableId);
      return asked.ok ? { goAhead: asked.goAhead } : { refused: "money", reason: asked.reason };
    },
  };
}
