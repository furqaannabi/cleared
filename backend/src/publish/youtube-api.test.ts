/**
 * The real YouTube port, with Google's network replaced by a stand-in (publish to paid spec PT-FR-02,
 * PT-FR-04, PT-FR-07, PT-FR-11, PT-FR-16, PT-BR-07, PT-BR-12). YouTube itself is checked by hand:
 * `pnpm test:youtube`.
 */
import { describe, expect, test } from "bun:test";
import { createYouTubeApi, secondsOf } from "./youtube-api";

const VIDEO = "dQw4w9WgXcQ";
const basic = {
  id: VIDEO,
  snippet: { channelId: "UC-sam", description: "My two weeks with Glow Serum.\nhttps://glow.example/sam", publishedAt: "2026-10-09T11:58:00Z" },
  status: { privacyStatus: "unlisted" },
  contentDetails: { duration: "PT1M1S" },
  paidProductPlacementDetails: { hasPaidProductPlacement: true },
};
const file = { id: VIDEO, fileDetails: { fileSize: "84512337", durationMs: "61500" } };

type Answer = { status: number; body?: unknown } | "fails";

/** A Google that answers each kind of call as the test says, and remembers what it was sent. */
function standIn(answers: { token?: Answer; video?: Answer; file?: Answer } = {}) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const logged: unknown[] = [];
  const reply = (answer: Answer | undefined, fallback: unknown) => {
    if (answer === "fails") throw new Error("socket hang up while sending refresh-sam");
    return new Response(JSON.stringify(answer?.body ?? fallback), { status: answer?.status ?? 200 });
  };
  const youtube = createYouTubeApi({
    clientId: "client-id",
    clientSecret: "client-secret",
    log: (...parts) => logged.push(parts),
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push({ url, init: init ?? {} });
      if (url.hostname === "oauth2.googleapis.com") return reply(answers.token, { access_token: "access-sam", expires_in: 3599 });
      return url.searchParams.get("part") === "fileDetails" ? reply(answers.file, { items: [file] }) : reply(answers.video, { items: [basic] });
    }) as typeof fetch,
  });
  return { youtube, calls, logged };
}

const reason = (code: number, why: string) => ({ status: code, body: { error: { code, message: `${why} for refresh-sam`, errors: [{ reason: why }] } } });

describe("PT-FR-02, PT-FR-11 one video's record, read with the creator's own read-only access", () => {
  test("the stored access is exchanged, then the video is read by id: where it is, who can see it, its description, its paid-promotion mark, and its file", async () => {
    const { youtube, calls } = standIn();

    expect(await youtube.video("refresh-sam", VIDEO)).toEqual({
      videoId: VIDEO,
      privacy: "unlisted",
      channelId: "UC-sam",
      description: "My two weeks with Glow Serum.\nhttps://glow.example/sam",
      paidPromotion: true,
      fileSizeBytes: 84_512_337n,
      durationSec: 61.5,
      publishedAt: new Date("2026-10-09T11:58:00Z"),
    });

    const [token, video, details] = calls;
    expect(`${token!.url.origin}${token!.url.pathname}`).toBe("https://oauth2.googleapis.com/token");
    expect(Object.fromEntries(new URLSearchParams(String(token!.init.body)))).toEqual({ grant_type: "refresh_token", refresh_token: "refresh-sam", client_id: "client-id", client_secret: "client-secret" });
    expect(`${video!.url.origin}${video!.url.pathname}`).toBe("https://www.googleapis.com/youtube/v3/videos");
    expect(video!.url.searchParams.get("id")).toBe(VIDEO);
    expect(new Headers(video!.init.headers).get("authorization")).toBe("Bearer access-sam");
    expect(details!.url.searchParams.get("part")).toBe("fileDetails");
  });

  test("PT-BR-07 YouTube is only ever read: every call to it is a GET", async () => {
    const { youtube, calls } = standIn();

    await youtube.video("refresh-sam", VIDEO);

    expect(calls.filter((call) => call.url.hostname === "www.googleapis.com").map((call) => call.init.method ?? "GET")).toEqual(["GET", "GET"]);
  });

  test("an id that is not a video's is never sent anywhere", async () => {
    const { youtube, calls } = standIn();

    expect(await youtube.video("refresh-sam", "../channels?mine=true")).toBe("not_found");
    expect(calls).toEqual([]);
  });
});

describe("PT-FR-04 when YouTube will not say", () => {
  test("a video that is not the caller's own has no file record: YouTube refuses that part, and the rest is returned", async () => {
    const { youtube } = standIn({ file: reason(403, "forbidden") });

    const record = await youtube.video("refresh-sam", VIDEO);

    expect(record).toMatchObject({ videoId: VIDEO, channelId: "UC-sam", durationSec: 61 });
    expect(record).not.toHaveProperty("fileSizeBytes");
  });

  test("a record with no file size, and no paid-promotion mark, leaves them out rather than guessing", async () => {
    const { youtube } = standIn({ video: { status: 200, body: { items: [{ ...basic, paidProductPlacementDetails: undefined }] } }, file: { status: 200, body: { items: [{ id: VIDEO }] } } });

    const record = await youtube.video("refresh-sam", VIDEO);

    expect(record).not.toHaveProperty("paidPromotion");
    expect(record).not.toHaveProperty("fileSizeBytes");
  });
});

describe("PT-FR-02 not found, and PT-FR-07 lost access", () => {
  test("no such video the creator can see is not found, and its file is not asked for", async () => {
    const { youtube, calls } = standIn({ video: { status: 200, body: { items: [] } } });

    expect(await youtube.video("refresh-sam", VIDEO)).toBe("not_found");
    expect(calls).toHaveLength(2);
  });

  test.each([
    ["access the creator revoked, or that expired", { token: { status: 400, body: { error: "invalid_grant" } } }],
    ["a token YouTube no longer takes", { video: reason(401, "authError") }],
    ["access that does not cover YouTube", { video: reason(403, "insufficientPermissions") }],
  ] as const)("%s is lost access, not a failure", async (_what, answers) => {
    const { youtube } = standIn(answers);

    expect(await youtube.video("refresh-sam", VIDEO)).toBe("no_access");
  });
});

describe("PT-FR-16 a failure of YouTube itself is thrown, so nothing is decided on it", () => {
  test.each([
    ["Google's token service is down", { token: { status: 503 } }],
    ["the token service cannot be reached", { token: "fails" }],
    ["YouTube is down", { video: { status: 500 } }],
    ["the day's quota is used up", { video: reason(403, "quotaExceeded") }],
    ["the rate limit is hit", { video: reason(403, "rateLimitExceeded") }],
    ["the file record fails for a reason other than not being the owner", { file: { status: 500 } }],
    ["the file record is refused for quota", { file: reason(403, "quotaExceeded") }],
    ["an answer that is not what YouTube documents", { video: { status: 200, body: { items: [{ id: VIDEO, snippet: {}, status: { privacyStatus: "hidden" } }] } } }],
  ] as const)("%s", async (_what, answers) => {
    const { youtube } = standIn(answers as never);

    expect(youtube.video("refresh-sam", VIDEO)).rejects.toThrow("YouTube");
  });
});

describe("PT-BR-12 nothing of a token, a secret or a description is logged or thrown", () => {
  test.each([
    ["a good read", {}],
    ["a refusal whose answer repeats the token", { video: reason(403, "quotaExceeded") }],
    ["a network failure whose message repeats the token", { token: "fails" }],
  ] as const)("%s", async (_what, answers) => {
    const { youtube, logged } = standIn(answers as never);

    const thrown = await youtube.video("refresh-sam", VIDEO).then(
      () => "",
      (error: Error) => error.message,
    );

    for (const secret of ["refresh-sam", "access-sam", "client-secret", "Glow Serum"]) {
      expect(JSON.stringify(logged)).not.toContain(secret);
      expect(thrown).not.toContain(secret);
    }
    expect(JSON.stringify(logged)).toContain(VIDEO);
  });
});

describe("a video's length as YouTube writes it", () => {
  test.each([
    ["PT1M1S", 61],
    ["PT45S", 45],
    ["PT1H2M3S", 3723],
    ["P1DT1S", 86_401],
    ["PT0S", 0],
  ])("%s is %i seconds", (written, seconds) => {
    expect(secondsOf(written)).toBe(seconds);
  });

  test("anything else is not a length", () => {
    for (const written of ["", "61", "PT", "one minute", "PT1.5S"]) expect(secondsOf(written)).toBeUndefined();
  });
});
