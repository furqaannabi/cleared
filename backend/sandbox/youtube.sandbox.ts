/**
 * The real YouTube port against YouTube itself (publish to paid spec, "To verify while building").
 * Run with `pnpm test:youtube`. It is not part of `pnpm test`: it needs GOOGLE_CLIENT_ID and
 * GOOGLE_CLIENT_SECRET, a channel connected through the app, and one of that channel's videos.
 *
 *   YOUTUBE_TEST_CHANNEL_ID   the connected channel's id (the one stored when it was connected)
 *   YOUTUBE_TEST_VIDEO_ID     a video on that channel, unlisted or public
 *
 * It reads that one video with the channel's stored access and prints what YouTube returned, which
 * settles the spec's open questions: does the owner get the file's size and length, and the
 * paid-promotion mark; and what date YouTube reports. Nothing is written to YouTube.
 */
import { expect, test } from "bun:test";
import { prisma } from "../src/db";
import { env } from "../src/env";
import { createYouTubeApi } from "../src/publish/youtube-api";
import { localSecrets } from "../src/secrets/secrets";

const channelId = process.env.YOUTUBE_TEST_CHANNEL_ID;
const videoId = process.env.YOUTUBE_TEST_VIDEO_ID;

test("one real video is read with its owner's read-only access", async () => {
  if (!env.google || !env.tokenKey || !channelId || !videoId) {
    throw new Error("Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TOKEN_KEY, YOUTUBE_TEST_CHANNEL_ID and YOUTUBE_TEST_VIDEO_ID to run this. See backend/.env.example.");
  }
  const account = await prisma.connectedAccount.findFirst({ where: { platform: "youtube", externalId: channelId, synthetic: false }, orderBy: { connectedAt: "desc" } });
  if (!account?.refreshTokenEncrypted) throw new Error("That channel is not connected. Sign in to the app and connect YouTube first.");
  const used: Record<string, unknown>[] = [];
  const youtube = createYouTubeApi({ ...env.google, log: (message, details) => used.push({ message, ...details }) });

  const record = await youtube.video(await localSecrets(env.tokenKey).decrypt(account.refreshTokenEncrypted), videoId);

  console.log(used);
  if (typeof record === "string") throw new Error(`YouTube answered: ${record}`);
  // The description is the creator's own text: its length is enough to see it came back.
  console.log({ ...record, description: `(${record.description.length} characters)`, fileSizeBytes: record.fileSizeBytes?.toString() });
  expect(record.channelId).toBe(channelId);
  console.log(`  file size returned: ${record.fileSizeBytes !== undefined}   length returned: ${record.durationSec !== undefined}   paid-promotion mark returned: ${record.paidPromotion !== undefined}`);
});
