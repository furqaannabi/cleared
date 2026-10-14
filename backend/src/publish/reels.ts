/**
 * Publishing a Reel (Instagram Reels spec IG-FR-11 to IG-FR-27): the go-ahead, "I've posted it" and
 * the live check.
 *
 * Instagram has no unlisted upload, so there is nothing to look at before the Reel is public. For the
 * go-ahead, what Sponing can check is that it can still read the creator's account, so that a creator
 * whose access is gone is told before they post, not after. Once it is posted the creator gives its
 * link: the Reel is found among their own media, recorded, and checked. The live check reads the
 * Reel's record, decides once whether its video is the approved draft, checks the caption, and gives
 * the money path one answer.
 *
 * Nothing here moves money or decides a money state: each step calls one function of the money path
 * and reports what it answers (IG-BR-03). Instagram is only ever read (IG-BR-01). A token, a caption,
 * a link and the address of a Reel's video are never logged or returned (IG-BR-02, IG-BR-12).
 */
import { randomUUID } from "node:crypto";
import { ServiceFailed } from "../checks/check";
import type { Judge, SpeechAndText } from "../checks/ports";
import { heardIn } from "../drafts/heard";
import type { PrismaClient } from "../generated/prisma/client";
import type { Download } from "../instagram/download";
import type { InstagramMedia, InstagramPort } from "../instagram/port";
import type { Media } from "../media/port";
import type { Money, MoneyRefusal } from "../money/money";
import type { GoAheadView } from "../money/view";
import type { Secrets } from "../secrets/secrets";
import type { Storage } from "../storage/port";
import { giveAnswer, liveItemsOf, startLiveCheckIn, type AnswerDeps } from "./live-check-record";
import { reelLiveCheck } from "./reel-live-check";
import { shortCodeFrom } from "./reel-link";
import { defaultMatchSettings, matchReel, type MatchSettings, type ReelMatch } from "./reel-match";

export type ReelGoAheadRefused =
  | { refused: "not_found" }
  /** The Reel's draft is not approved, so there is nothing to post yet. */
  | { refused: "not_approved" }
  /** Sponing cannot read the creator's Instagram account: not connected, revoked, or expired (IG-FR-13). */
  | { refused: "reconnect_instagram" }
  /** Instagram itself failed. Nothing was decided; the creator tries again. */
  | { refused: "instagram_unavailable" }
  /** The money path refused, with its own reason (MP-FR-10). */
  | { refused: "money"; reason: MoneyRefusal };

export type ReelPostedRefused =
  | { refused: "not_found" }
  /** Not a link to a Reel or a post on Instagram's own address (IG-FR-14). */
  | { refused: "not_an_instagram_link" }
  | { refused: "not_approved" }
  /** A Reel is already recorded for the post, and this is another one (IG-FR-16). */
  | { refused: "already_published" }
  | { refused: "reconnect_instagram" | "instagram_unavailable" }
  /** Not among the creator's own recent media, or there and not a Reel (IG-FR-15). */
  | { refused: "reel_not_found" | "not_a_reel" }
  | { refused: "money"; reason: MoneyRefusal };

export interface ReelSettings {
  /** How many of the creator's most recent media are searched for the Reel (IG-FR-15). */
  searched: number;
  match: MatchSettings;
  /** The largest video fetched, in bytes: the draft's own limit (IG-FR-20). */
  maxBytes: number;
  /** How long the address that reads the fetched video works for. */
  addressSeconds: number;
  /** How often the reading of the fetched video is asked after, and how long it may take before it counts as failed. */
  pollSeconds: number;
  readingLimitSeconds: number;
  /** How many readings of a fetched video may fail before it counts as not fetched. Each one is paid for (IG-FR-26). */
  maxReadings: number;
  /** The wait before a check that could not read Instagram, fetch the video or reach the judge tries again. It doubles each time, up to the longest wait (IG-FR-26). */
  retryFirstSeconds: number;
  retryLongestSeconds: number;
}

export const defaultReelSettings: ReelSettings = {
  searched: 100,
  match: defaultMatchSettings,
  maxBytes: 1024 ** 3,
  addressSeconds: 15 * 60,
  pollSeconds: 10,
  readingLimitSeconds: 30 * 60,
  maxReadings: 3,
  retryFirstSeconds: 60,
  retryLongestSeconds: 3600,
};

/** Whether a live Reel is the approved draft, as it is kept with the Reel once decided (IG-FR-22). */
type Decided = "same" | "different" | "unknown" | "not_fetched";
const DECIDED: readonly string[] = ["same", "different", "unknown", "not_fetched"];

/** What is needed to fetch a Reel's video and read it, for the match. Without it no Reel's live check can run. */
export interface ReelReading {
  storage: Storage;
  media: Pick<Media, "probe">;
  speech: SpeechAndText;
  download: Download;
}

export type ReelPublishing = ReturnType<typeof createReelPublishing>;

export function createReelPublishing(deps: {
  prisma: PrismaClient;
  now?: () => Date;
  instagram: Pick<InstagramPort, "account" | "findMedia" | "media">;
  /** Decrypts a creator's stored access to Instagram. It is never logged or returned. */
  secrets: Secrets;
  money?: Pick<Money, "view" | "askGoAhead" | "postPublished" | "liveCheckResult">;
  reading?: ReelReading;
  /** Judges written items that need judgment. Its pass counts only if its quote is in the caption (IG-BR-04). */
  judge?: Pick<Judge, "judgeWritten">;
  notices?: AnswerDeps["notices"];
  settings?: Partial<ReelSettings>;
  /** Told what happened, with ids and codes only. Never a caption, a link or an address (IG-BR-12). */
  log?: (message: string, details: Record<string, unknown>) => void;
}) {
  const { prisma, instagram, secrets, money, reading, judge, log } = deps;
  const now = deps.now ?? (() => new Date());
  const settings = { ...defaultReelSettings, ...deps.settings };

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

  /** Ends a check that gave the money path no answer, with the reason if the creator can do something about it (IG-FR-27). */
  async function stop(deliverableId: string, blockedBy: "reconnect_instagram" | "reel_not_found" | null, fetchedKey: string | null): Promise<void> {
    await prisma.liveCheck.update({ where: { deliverableId }, data: { running: false, blockedBy, fetchedKey: null, fetchedSec: null, speechJobId: null, readingSince: null } });
    // Nothing of a live Reel is kept once its check has stopped.
    if (fetchedKey && reading) await reading.storage.deleteUnder(fetchedKey);
    log?.("A Reel's live check gave no answer", { deliverableId, because: blockedBy ?? "nothing_left_to_decide" });
  }

  /** Records the match with the Reel, once (IG-FR-22), and deletes the video that was fetched to decide it (IG-FR-20). */
  async function decided(deliverableId: string, match: Decided, why: string | undefined, fetchedKey: string | null): Promise<{ match: Decided }> {
    await prisma.$transaction([
      prisma.postVideo.update({ where: { deliverableId }, data: { fileMatch: match } }),
      prisma.liveCheck.update({ where: { deliverableId }, data: { fetchedKey: null, fetchedSec: null, speechJobId: null, readingSince: null } }),
    ]);
    if (fetchedKey && reading) await reading.storage.deleteUnder(fetchedKey);
    log?.("A live Reel was matched to its approved draft", { deliverableId, match, ...(why ? { because: why } : {}) });
    return { match };
  }
  const settled = (deliverableId: string, match: ReelMatch, fetchedKey: string | null) => decided(deliverableId, match.match, "because" in match ? match.because : undefined, fetchedKey);

  /**
   * One step towards deciding whether the live Reel is the approved draft (IG-FR-20, IG-FR-21). Its
   * video is fetched once from the address Instagram returned, its length is read, and its speech is
   * read only if length and the draft's own words leave something to compare. Fixed code decides.
   * Returns the match, or when to come back: the reading takes minutes, and a fetch can fail for a
   * reason that passes (IG-FR-26).
   */
  async function matchStep(
    deliverableId: string,
    reel: InstagramMedia,
    draft: { storageKey: string; durationSec: number },
    check: { fetchedKey: string | null; fetchedSec: number | null; speechJobId: string | null; readingSince: Date | null },
    tryLater: { retryAt: Date },
    use: ReelReading,
  ): Promise<{ match: Decided } | { retryAt: Date }> {
    const at = now();
    const poll = { retryAt: new Date(at.getTime() + settings.pollSeconds * 1000) };
    const failed = (what: string) => {
      log?.("A live Reel's video could not be read just now", { deliverableId, what });
      return tryLater;
    };
    const startReading = async (key: string) => {
      const { jobId } = await use.speech.start(key);
      await prisma.liveCheck.update({ where: { deliverableId }, data: { speechJobId: jobId, readingSince: at } });
    };
    const heard = await heardIn(use.storage, draft.storageKey);

    if (!check.fetchedKey || check.fetchedSec === null) {
      // Instagram gives no address for a Reel's video when it carries licensed music. Nothing can be compared.
      if (!reel.videoUrl) return decided(deliverableId, "not_fetched", "no_address", null);
      const key = `live/${deliverableId}/${randomUUID()}`;
      let found;
      try {
        // Only ever the address Instagram's own API returned (IG-BR-08), into the private bucket, cut off at the draft's limit.
        const stored = await use.storage.put(key, await use.download(reel.videoUrl), { maxBytes: settings.maxBytes });
        // Larger than any draft may be. It is not fetched, so the brand is the one to look.
        if (stored === "too_large") return decided(deliverableId, "not_fetched", "too_large", null);
        found = await use.media.probe(await use.storage.address(key, settings.addressSeconds));
      } catch {
        // Nothing of the error is kept: it can repeat the address.
        await use.storage.deleteUnder(key).catch(() => {});
        return failed("fetch");
      }
      if (found === "unreadable") {
        await use.storage.deleteUnder(key);
        return failed("file");
      }
      // A video of a kind the service does not read has no length to compare. That is not a fault that was seen (IG-BR-06): the brand looks.
      if (found.format === "other") return decided(deliverableId, "not_fetched", "not_readable", key);
      // Length first, and whether the draft has words enough to compare: both are known before anything is paid for.
      const early = matchReel({ durationSec: draft.durationSec, speech: heard ?? [] }, { durationSec: found.durationSec, speech: [] }, settings.match);
      if ((early.match === "different" && early.because === "length") || (early.match === "unknown" && early.because === "too_little_speech")) return settled(deliverableId, early, key);

      await prisma.liveCheck.update({ where: { deliverableId }, data: { fetchedKey: key, fetchedSec: found.durationSec } });
      try {
        await startReading(key);
      } catch {
        return failed("reading_start");
      }
      return poll;
    }

    const key = check.fetchedKey;
    try {
      if (!check.speechJobId) {
        await startReading(key);
        return poll;
      }
      const read = await use.speech.result(check.speechJobId);
      if (read.state === "working" && at.getTime() - (check.readingSince ?? at).getTime() <= settings.readingLimitSeconds * 1000) return poll;
      if (read.state !== "done") {
        // A reading that failed, or ran past its time, was paid for. After the last one allowed the video counts as not fetched, and the brand looks.
        const { failedReadings } = await prisma.liveCheck.update({ where: { deliverableId }, data: { speechJobId: null, readingSince: null, failedReadings: { increment: 1 } } });
        if (failedReadings >= settings.maxReadings) return decided(deliverableId, "not_fetched", "reading_failed", key);
        // The next try reads the fetched video afresh.
        return failed("reading");
      }
      // What was said is untrusted: it is compared with the draft's words by code, and never obeyed (IG-BR-09).
      return settled(deliverableId, matchReel({ durationSec: draft.durationSec, speech: heard ?? [] }, { durationSec: check.fetchedSec, speech: read.speech }, settings.match), key);
    } catch {
      return failed("reading");
    }
  }

  return {
    /**
     * "I've posted it" for a Reel, with its link (IG-FR-14 to IG-FR-17). The short code is taken from
     * the link by code and the link is never fetched. The Reel is then looked for among the creator's
     * own recent media, with their own access, so nobody else's Reel can be recorded (IG-BR-07). Found,
     * it is recorded with the moment as when the post was published, the live check starts, and the
     * money path is told.
     */
    async posted(creatorId: string, deliverableId: string, url: string): Promise<{ publishedAt: Date } | ReelPostedRefused> {
      const post = await prisma.deliverable.findFirst({ where: { id: deliverableId, platform: "instagram_reel", deal: { creatorId } } });
      if (!post) return { refused: "not_found" };
      const shortCode = shortCodeFrom(url);
      if (!shortCode) return { refused: "not_an_instagram_link" };
      const approved = await prisma.draftCheck.findUnique({ where: { deliverableId } });
      if (!approved?.approvedAt) return { refused: "not_approved" };
      const stage = (await money?.view(deliverableId))?.stage;
      if (!money || stage !== "held") return { refused: "money", reason: "not_held" };

      const recorded = await prisma.postVideo.findUnique({ where: { deliverableId } });
      if (recorded && recorded.shortCode !== shortCode) return { refused: "already_published" };
      const check = await prisma.liveCheck.findUnique({ where: { deliverableId } });
      // Said again while the check runs, or after it answered: nothing new starts.
      if (recorded?.seenPublicAt && check && (check.running || check.answer)) return { publishedAt: recorded.seenPublicAt };

      const stored = await accountOf(creatorId);
      if (!stored) return { refused: "reconnect_instagram" };
      let found;
      try {
        found = await instagram.findMedia(stored.token, shortCode, settings.searched);
      } catch {
        return { refused: "instagram_unavailable" };
      }
      if (found === "no_access") return { refused: "reconnect_instagram" };
      if (found === "not_found") return { refused: "reel_not_found" };
      if (!found.isReel) return { refused: "not_a_reel" };

      const at = now();
      const reel = { videoId: found.id, shortCode: found.shortCode, link: found.link ?? null, postedAt: found.postedAt ?? null };
      const { seenPublicAt } = await prisma.$transaction(async (tx) => {
        // The match is decided by the live check, once. Said again for the same Reel, what was decided stays.
        await tx.postVideo.upsert({ where: { deliverableId }, create: { deliverableId, ...reel, fileMatch: "pending", recordedAt: at }, update: reel });
        return startLiveCheckIn(tx, deliverableId, at);
      });
      log?.("A Reel was recorded for a post", { deliverableId, mediaId: found.id });
      // The money path's own record of it (MP-FR-16). The live check tells it again before it answers, so a failure here loses nothing.
      const told = await money.postPublished(deliverableId, seenPublicAt);
      return told.ok ? { publishedAt: seenPublicAt } : { refused: "money", reason: told.reason };
    },

    /**
     * One run of a Reel's live check (IG-FR-19 to IG-FR-27). It reads the Reel's record from Instagram,
     * decides the match once, works out each item's result and the one answer in fixed code, gives the
     * money path that answer, and records what it found. A check that could not read Instagram, fetch
     * the video or reach the judge gives no answer at all (IG-BR-05).
     */
    async liveCheck(deliverableId: string, attempts: number): Promise<void | { retryAt: Date }> {
      const [recorded, check] = await Promise.all([prisma.postVideo.findUnique({ where: { deliverableId } }), prisma.liveCheck.findUnique({ where: { deliverableId } })]);
      if (!recorded?.seenPublicAt || !check?.running) return;
      const post = await prisma.deliverable.findUnique({ where: { id: deliverableId }, include: { deal: true } });
      const view = await money?.view(deliverableId);
      // Once the hold is taken or given back there is nothing left for a check to decide.
      if (!post?.deal.creatorId || !money || !judge || !reading || view?.stage !== "held") return stop(deliverableId, null, check.fetchedKey);

      const tryLater = { retryAt: new Date(now().getTime() + Math.min(settings.retryFirstSeconds * 2 ** (attempts - 1), settings.retryLongestSeconds) * 1000) };
      const stored = await accountOf(post.deal.creatorId);
      if (!stored) return stop(deliverableId, "reconnect_instagram", check.fetchedKey);
      let reel;
      try {
        reel = await instagram.media(stored.token, recorded.videoId);
      } catch {
        return tryLater;
      }
      if (reel === "no_access") return stop(deliverableId, "reconnect_instagram", check.fetchedKey);
      // Gone, or no longer the Reel that was recorded. Read with the creator's own access, it can only be theirs.
      if (reel === "not_found" || !reel.isReel || reel.shortCode !== recorded.shortCode) return stop(deliverableId, "reel_not_found", check.fetchedKey);

      // The money path takes a result only for a post it knows is published (MP-FR-16). Telling it twice changes nothing.
      if (!view.publishedAt && !(await money.postPublished(deliverableId, recorded.seenPublicAt)).ok) return stop(deliverableId, null, check.fetchedKey);

      const approved = await prisma.draftCheck.findUnique({ where: { deliverableId } });
      const draft = approved?.draftId ? await prisma.draft.findUnique({ where: { id: approved.draftId } }) : null;
      if (!draft) throw new Error("A Reel at its live check has no approved draft");

      // Decided once, and kept with the Reel. A later check reads the caption again and nothing else (IG-FR-22).
      let match: Decided;
      if (DECIDED.includes(recorded.fileMatch)) {
        match = recorded.fileMatch as Decided;
      } else {
        const step = await matchStep(deliverableId, reel, draft, check, tryLater, reading);
        if ("retryAt" in step) return step;
        match = step.match;
      }

      const items = await liveItemsOf(prisma, deliverableId, post.deal);
      let found;
      try {
        found = await reelLiveCheck({ caption: reel.caption, match: { match }, items, judgeWritten: (input) => judge.judgeWritten(input) });
      } catch (error) {
        // The judge could not be reached. Nothing was decided, so nothing is said (IG-BR-05).
        if (error instanceof ServiceFailed) return tryLater;
        throw error;
      }

      await giveAnswer({ prisma, now, money, notices: deps.notices, log }, deliverableId, found, { id: recorded.videoId, date: reel.postedAt });
    },

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
