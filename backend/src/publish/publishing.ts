/**
 * Publishing (publish to paid spec PT-FR-01 to PT-FR-07): the creator asks for the go-ahead with the
 * video on their channel. Cleared reads the video from YouTube and checks it is the approved draft's
 * file on the creator's own channel, and only then asks the money path, which alone decides whether
 * there is a go-ahead (PT-BR-01, PT-BR-05). Nothing is ever written to YouTube (PT-BR-07).
 */
import type { PrismaClient } from "../generated/prisma/client";
import type { Money, MoneyRefusal } from "../money/money";
import type { GoAheadView } from "../money/view";
import type { Secrets } from "../secrets/secrets";
import type { VideoRecord } from "./live-check";
import { sameFile, videoIdFrom } from "./video";
import type { YouTube } from "./youtube";

export type GoAheadRefused =
  | { refused: "not_found" }
  | { refused: "not_a_youtube_link" }
  /** The post's draft is not approved, so there is nothing to publish yet. */
  | { refused: "not_approved" }
  /** Cleared cannot read the creator's YouTube: never really connected, revoked, or expired (PT-FR-07). */
  | { refused: "reconnect_youtube" }
  /** YouTube itself failed. Nothing was decided; the creator tries again. */
  | { refused: "youtube_unavailable" }
  | { refused: "video_not_found" | "video_private" | "not_your_channel" | "not_the_approved_file" }
  /** The money path refused, with its own reason (MP-FR-10). */
  | { refused: "money"; reason: MoneyRefusal };

export type Publishing = ReturnType<typeof createPublishing>;

export function createPublishing(deps: {
  prisma: PrismaClient;
  now: () => Date;
  youtube: YouTube;
  /** Decrypts a creator's stored access to YouTube. It is never logged or returned (DS-BR-14). */
  secrets: Secrets;
  money?: Pick<Money, "view" | "askGoAhead">;
}) {
  const { prisma, now, youtube, secrets, money } = deps;

  /** The creator's connected channel and their stored access to it, if there is any that could work. */
  async function channelOf(creatorId: string): Promise<{ channelId: string; refreshToken: string } | undefined> {
    const account = await prisma.connectedAccount.findUnique({ where: { creatorId_platform: { creatorId, platform: "youtube" } } });
    if (!account?.refreshTokenEncrypted) return undefined;
    try {
      return { channelId: account.externalId, refreshToken: await secrets.decrypt(account.refreshTokenEncrypted) };
    } catch {
      // Stored under a key that is gone. There is no access to use.
      return undefined;
    }
  }

  /** Reads one video as the creator. A failure of YouTube itself is told apart from lost access. */
  async function read(refreshToken: string, videoId: string): Promise<VideoRecord | "not_found" | "no_access" | "unavailable"> {
    try {
      return await youtube.video(refreshToken, videoId);
    } catch {
      return "unavailable";
    }
  }

  return {
    /**
     * Asks for the go-ahead (PT-FR-01 to PT-FR-07). In order: the post and its approved draft, the
     * video read from YouTube and matched to that draft's file, the video recorded for the post, and
     * then the money path's own answer. PayPal is asked nothing until the video is accepted.
     */
    async askGoAhead(creatorId: string, deliverableId: string, videoUrl: string): Promise<{ goAhead: GoAheadView } | GoAheadRefused> {
      const post = await prisma.deliverable.findFirst({ where: { id: deliverableId, deal: { creatorId } } });
      if (!post) return { refused: "not_found" };
      const videoId = videoIdFrom(videoUrl);
      if (!videoId) return { refused: "not_a_youtube_link" };

      const check = await prisma.draftCheck.findUnique({ where: { deliverableId } });
      const draft = check?.approvedAt && check.draftId ? await prisma.draft.findUnique({ where: { id: check.draftId } }) : null;
      if (!draft) return { refused: "not_approved" };
      // A hold that has been released or taken has no go-ahead to give. The money path says so before YouTube is asked.
      const stage = (await money?.view(deliverableId))?.stage;
      if (!money || stage !== "held") return { refused: "money", reason: "not_held" };

      const channel = await channelOf(creatorId);
      if (!channel) return { refused: "reconnect_youtube" };
      const video = await read(channel.refreshToken, videoId);
      if (video === "no_access") return { refused: "reconnect_youtube" };
      if (video === "unavailable") return { refused: "youtube_unavailable" };
      if (video === "not_found") return { refused: "video_not_found" };
      if (video.privacy === "private") return { refused: "video_private" };
      if (video.channelId !== channel.channelId) return { refused: "not_your_channel" };
      const fileMatch = sameFile(draft, video);
      if (fileMatch === "different") return { refused: "not_the_approved_file" };

      // The video is accepted. It is the one the live check will look at, until the creator gives another.
      const at = now();
      await prisma.postVideo.upsert({
        where: { deliverableId },
        create: { deliverableId, videoId, fileMatch, recordedAt: at },
        update: { videoId, fileMatch, recordedAt: at },
      });

      const asked = await money.askGoAhead(deliverableId);
      return asked.ok ? { goAhead: asked.goAhead } : { refused: "money", reason: asked.reason };
    },
  };
}
