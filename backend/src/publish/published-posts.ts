/**
 * The answer to the money path's one question (publish to paid spec PT-FR-09, PT-FR-10): is this
 * deliverable's post published, and since when. The money path asks when a go-ahead ends and at the
 * deadline (MP-FR-15, MP-FR-22). The answer is read from YouTube: the recorded video, public. The
 * first time it is seen public, that moment is recorded and the live check is started, as if the
 * creator had said so. It is decided by fixed code, never by a model.
 */
import type { PublishedPostPort } from "../money/published-post";
import { startLiveCheckIn } from "./publishing";
import { createReader, type ReaderDeps } from "./reader";

export function createPublishedPosts(deps: ReaderDeps & { now: () => Date }): PublishedPostPort {
  const { prisma, now } = deps;
  const reader = createReader(deps);

  return {
    async publishedAt(deliverableId) {
      const recorded = await prisma.postVideo.findUnique({ where: { deliverableId } });
      if (!recorded) return null;
      // Already seen public: when that was is the answer, and YouTube is not asked again.
      if (recorded.seenPublicAt) return recorded.seenPublicAt;

      const post = await prisma.deliverable.findUnique({ where: { id: deliverableId }, include: { deal: true } });
      const channel = post && (await reader.channelOf(post.deal.creatorId));
      // A channel Cleared cannot read shows it nothing published. The deadline runs as for any post not seen in time (PT-FR-17).
      if (!channel) return null;
      const video = await reader.read(channel.refreshToken, recorded.videoId);
      // YouTube itself failed: there is no answer either way, and the money path asks again.
      if (video === "unavailable") throw new Error("YouTube could not be read to see whether a post is published");
      if (video === "no_access" || video === "not_found" || video.privacy !== "public") return null;

      const { seenPublicAt } = await prisma.$transaction((tx) => startLiveCheckIn(tx, deliverableId, now()));
      return seenPublicAt;
    },
  };
}
