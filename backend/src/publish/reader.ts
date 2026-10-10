/**
 * Reading a creator's video from YouTube with their stored read-only access (publish to paid spec
 * PT-FR-02, PT-FR-07, PT-FR-11). Shared by the go-ahead, "I've posted it", the live check and the
 * answer to the money path's question. Nothing is ever written to YouTube (PT-BR-07).
 */
import type { PrismaClient } from "../generated/prisma/client";
import type { Secrets } from "../secrets/secrets";
import type { VideoRecord } from "./live-check";
import type { YouTube } from "./youtube";

export interface ReaderDeps {
  prisma: PrismaClient;
  youtube: YouTube;
  /** Decrypts a creator's stored access to YouTube. It is never logged or returned (DS-BR-14). */
  secrets: Secrets;
  /**
   * YouTube's id of the one real channel the team owns, which demo accounts read through (PT-FR-36;
   * docs/decisions/2026-10-10-demo-accounts-read-a-shared-channel.md). The team connects it once, as
   * any creator connects theirs. Without it a demo account's made-up channel cannot be read.
   */
  demoChannelId?: string;
}

export type Reader = ReturnType<typeof createReader>;

export function createReader({ prisma, youtube, secrets, demoChannelId }: ReaderDeps) {
  return {
    /**
     * The creator's connected channel and their stored access to it, if there is any that could work.
     * A demo account's is the team's channel, read with the access the team gave when it connected it.
     * Nothing else about a demo account differs: the same reads, the same rules.
     */
    async channelOf(creatorId: string): Promise<{ channelId: string; refreshToken: string } | undefined> {
      const creator = await prisma.creator.findUnique({ where: { id: creatorId }, select: { demo: true } });
      const account =
        creator?.demo && demoChannelId
          ? await prisma.connectedAccount.findFirst({ where: { platform: "youtube", externalId: demoChannelId, synthetic: false, creator: { demo: false } }, orderBy: { connectedAt: "desc" } })
          : await prisma.connectedAccount.findUnique({ where: { creatorId_platform: { creatorId, platform: "youtube" } } });
      if (!account?.refreshTokenEncrypted) return undefined;
      try {
        return { channelId: account.externalId, refreshToken: await secrets.decrypt(account.refreshTokenEncrypted) };
      } catch {
        // Stored under a key that is gone. There is no access to use.
        return undefined;
      }
    },

    /** Reads one video as the creator. A failure of YouTube itself is told apart from lost access. */
    async read(refreshToken: string, videoId: string): Promise<VideoRecord | "not_found" | "no_access" | "unavailable"> {
      try {
        return await youtube.video(refreshToken, videoId);
      } catch {
        return "unavailable";
      }
    },
  };
}
