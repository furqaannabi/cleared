/**
 * The real YouTube port: the YouTube Data API, called with plain HTTPS as Google's sign-in is (publish
 * to paid spec PT-FR-02, PT-FR-11). A creator's stored access is exchanged for a short-lived token, and
 * one video's record is read with it. Every call to YouTube is a GET: nothing is ever written to a
 * creator's channel (PT-BR-07). A token, the client secret and a video's description are never logged
 * or put in an error (PT-BR-12).
 *
 * Not yet proven against YouTube itself. The request and the fields are as Google documents them;
 * `pnpm test:youtube` reads one real video by hand. Whether the file's size and length, and the
 * paid-promotion mark, come back for the owner's own video is what that run settles.
 */
import { z } from "zod";
import type { VideoRecord } from "./live-check";
import type { YouTube } from "./youtube";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";
const TIMEOUT_MS = 15_000;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** The reasons YouTube gives when it is the service, not the caller's access, that will not answer. */
const BUSY = ["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded", "userRateLimitExceeded", "backendError"];

const Basic = z.object({
  snippet: z.object({ channelId: z.string().min(1), description: z.string().default(""), publishedAt: z.string().optional() }),
  status: z.object({ privacyStatus: z.enum(["public", "unlisted", "private"]) }),
  contentDetails: z.object({ duration: z.string().optional() }).optional(),
  paidProductPlacementDetails: z.object({ hasPaidProductPlacement: z.boolean().optional() }).optional(),
});
const File = z.object({ fileDetails: z.object({ fileSize: z.string().regex(/^\d{1,19}$/).optional(), durationMs: z.string().regex(/^\d{1,15}$/).optional() }).optional() });

/** A length as YouTube writes it, such as PT1M1S, in whole seconds. Nothing if it is not one. */
export function secondsOf(written: string): number | undefined {
  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(written);
  if (!match || match.slice(1).every((part) => part === undefined)) return undefined;
  const [days, hours, minutes, seconds] = match.slice(1).map((part) => Number(part ?? 0));
  return days! * 86_400 + hours! * 3600 + minutes! * 60 + seconds!;
}

/** Why YouTube refused, if its answer says: the first reason in the error it documents. */
async function reasonOf(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { error?: { errors?: { reason?: unknown }[] } };
    const reason = body.error?.errors?.[0]?.reason;
    return typeof reason === "string" ? reason : undefined;
  } catch {
    return undefined;
  }
}

export function createYouTubeApi(config: {
  clientId: string;
  clientSecret: string;
  /** Told how each read went: a video's id, statuses and a timing. Never a token or anything from the video. */
  log?: (message: string, details: Record<string, unknown>) => void;
  /** The network. Tests pass a stand-in. */
  fetch?: typeof fetch;
}): YouTube {
  const send = config.fetch ?? fetch;

  /** One call. A network failure becomes an error that carries nothing of what was sent. */
  async function call(what: string, url: string, init: RequestInit): Promise<Response> {
    try {
      return await send(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new Error(`YouTube could not be reached for ${what}`);
    }
  }

  /** A short-lived token for the creator's stored access, or "no_access" if Google says that access is gone. */
  async function tokenFor(refreshToken: string): Promise<string | "no_access"> {
    const response = await call("a token", TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: config.clientId, client_secret: config.clientSecret }).toString(),
    });
    if (response.status === 400 || response.status === 401) {
      // Revoked by the creator, or expired. Any other refusal is Google's own trouble.
      const error = ((await response.json().catch(() => ({}))) as { error?: unknown }).error;
      if (error === "invalid_grant") return "no_access";
    }
    if (!response.ok) throw new Error(`YouTube's sign-in answered ${response.status} for a token`);
    const token = ((await response.json().catch(() => ({}))) as { access_token?: unknown }).access_token;
    if (typeof token !== "string" || !token) throw new Error("YouTube's sign-in gave no token");
    return token;
  }

  /** One part of a video's record: the first item, "none" if there is no such video, or why the caller may not read it. */
  async function part(token: string, videoId: string, parts: string): Promise<{ item: unknown } | "none" | "no_access" | "not_allowed"> {
    const url = `${VIDEOS_URL}?${new URLSearchParams({ part: parts, id: videoId, maxResults: "1" })}`;
    const response = await call("a video", url, { method: "GET", headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
    if (response.status === 401) return "no_access";
    if (response.status === 403) {
      const reason = await reasonOf(response);
      if (reason && BUSY.includes(reason)) throw new Error(`YouTube answered 403 (${reason}) for a video`);
      return reason === "insufficientPermissions" ? "no_access" : "not_allowed";
    }
    if (!response.ok) throw new Error(`YouTube answered ${response.status} for a video`);
    const items = ((await response.json().catch(() => ({}))) as { items?: unknown }).items;
    return Array.isArray(items) && items.length > 0 ? { item: items[0] } : "none";
  }

  return {
    async video(refreshToken, videoId) {
      // An id is only ever one of YouTube's own. Anything else is no video, and goes nowhere.
      if (!VIDEO_ID.test(videoId)) return "not_found";
      const started = Date.now();
      const done = (outcome: string) => config.log?.("YouTube was read for a video", { videoId, outcome, ms: Date.now() - started });
      try {
        const token = await tokenFor(refreshToken);
        if (token === "no_access") return done("no_access"), "no_access";

        const read = await part(token, videoId, "snippet,status,contentDetails,paidProductPlacementDetails");
        if (read === "no_access" || read === "not_allowed") return done("no_access"), "no_access";
        if (read === "none") return done("not_found"), "not_found";
        const basic = Basic.safeParse(read.item);
        if (!basic.success) throw new Error("YouTube's answer for a video was not in the shape it documents");

        // The uploaded file's own record, which YouTube gives only to the video's owner (PT-FR-04).
        const owned = await part(token, videoId, "fileDetails");
        const file = typeof owned === "object" ? File.safeParse(owned.item) : undefined;
        const details = file?.success ? file.data.fileDetails : undefined;

        const { snippet, status, contentDetails, paidProductPlacementDetails } = basic.data;
        const exact = details?.durationMs === undefined ? undefined : Number(details.durationMs) / 1000;
        const durationSec = exact ?? (contentDetails?.duration ? secondsOf(contentDetails.duration) : undefined);
        const paid = paidProductPlacementDetails?.hasPaidProductPlacement;
        const publishedAt = snippet.publishedAt ? new Date(snippet.publishedAt) : undefined;
        const record: VideoRecord = {
          videoId,
          privacy: status.privacyStatus,
          channelId: snippet.channelId,
          // Untrusted text, kept to YouTube's own limit. It is searched and quoted, never obeyed (PT-BR-06).
          description: snippet.description.slice(0, 5000),
          ...(paid === undefined ? {} : { paidPromotion: paid }),
          ...(details?.fileSize === undefined ? {} : { fileSizeBytes: BigInt(details.fileSize) }),
          ...(durationSec === undefined ? {} : { durationSec }),
          ...(publishedAt && !Number.isNaN(publishedAt.getTime()) ? { publishedAt } : {}),
        };
        done(details?.fileSize === undefined ? "read_without_file" : "read");
        return record;
      } catch (error) {
        done("failed");
        // Only this module's own messages leave it: none repeats a token or anything from a video.
        throw new Error(error instanceof Error && error.message.startsWith("YouTube") ? error.message : "YouTube could not be read");
      }
    },
  };
}
