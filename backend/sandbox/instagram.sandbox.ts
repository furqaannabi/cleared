/**
 * What Instagram's API really returns, checked by hand before anything is built on it (Instagram Reels
 * spec IG-FR-01, "To verify"). Run with `pnpm test:instagram`. It is not part of `pnpm test`: it needs a
 * real tester account, and it reads that account's own media. Nothing is written to Instagram.
 *
 *   INSTAGRAM_TEST_TOKEN     a token for a tester account. The quickest way to one: in Meta's app
 *                            dashboard, Instagram > API setup with Instagram login > Generate token.
 *
 * And, to try the connection itself (optional; needs a browser):
 *
 *   INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET
 *   INSTAGRAM_REDIRECT_URI   exactly as registered in the app. The page need not exist.
 *   INSTAGRAM_TEST_CODE      the `code` from the address the browser lands on after signing in.
 *                            It works once, and only for a short time.
 *
 * It prints which fields came back, never their contents: no caption, no token, no video address.
 */
import { describe, expect, test } from "bun:test";
import { createFfmpegMedia } from "../src/media/ffmpeg";

const GRAPH = "https://graph.instagram.com";
const token = process.env.INSTAGRAM_TEST_TOKEN;
const appId = process.env.INSTAGRAM_APP_ID;
const appSecret = process.env.INSTAGRAM_APP_SECRET;
const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
const code = process.env.INSTAGRAM_TEST_CODE;

/** Text with every secret this run holds taken out, in case Instagram repeats one in an error. */
const safe = (text: string) => [token, appSecret, code].reduce<string>((clean, secret) => (secret ? clean.split(secret).join("<hidden>") : clean), text).slice(0, 300);

/** One read of Instagram's API. A refusal is returned with its status and Instagram's own words for it. */
async function read(path: string, params: Record<string, string>, base = GRAPH) {
  const response = await fetch(`${base}${path}?${new URLSearchParams(params)}`, { signal: AbortSignal.timeout(20_000) });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (response.ok) return { ok: true as const, body };
  const error = (body.error ?? body) as { message?: unknown; type?: unknown; code?: unknown; error_subcode?: unknown };
  return { ok: false as const, status: response.status, why: safe(`${String(error.type ?? "")} code ${String(error.code ?? "?")}${error.error_subcode ? `/${String(error.error_subcode)}` : ""}: ${String(error.message ?? "")}`) };
}

const need = (value: string | undefined, name: string): string => {
  if (!value) throw new Error(`Set ${name} to run this. See the top of backend/sandbox/instagram.sandbox.ts.`);
  return value;
};

type Media = { id?: string; shortcode?: string; permalink?: string; media_type?: string; media_product_type?: string; timestamp?: string; caption?: string; media_url?: string };
const FIELDS = "id,shortcode,permalink,media_type,media_product_type,timestamp,caption,media_url";

describe("IG-FR-01 reading a tester account", () => {
  test("the account: its id, its name and its type", async () => {
    const account = await read("/me", { fields: "user_id,username,account_type", access_token: need(token, "INSTAGRAM_TEST_TOKEN") });
    if (!account.ok) throw new Error(`Instagram refused: ${account.status} ${account.why}`);

    console.log(`  account: id returned ${typeof account.body.user_id === "string" || typeof account.body.id === "string"} | name returned ${typeof account.body.username === "string"} | type: ${String(account.body.account_type)}`);
    console.log(`  fields that came back: ${Object.keys(account.body).join(", ")}`);
    expect(typeof account.body.username).toBe("string");
  });

  test("its media: what one listing returns, and which fields each Reel carries", async () => {
    const listing = await read("/me/media", { fields: FIELDS, limit: "100", access_token: need(token, "INSTAGRAM_TEST_TOKEN") });
    if (!listing.ok) throw new Error(`Instagram refused: ${listing.status} ${listing.why}`);
    const media = (listing.body.data ?? []) as Media[];
    const paging = listing.body.paging as { next?: string; cursors?: { after?: string } } | undefined;

    console.log(`  one listing returned ${media.length} media (asked for 100) | a next page is offered: ${!!paging?.next} | by cursor: ${!!paging?.cursors?.after}`);
    const kinds = new Map<string, number>();
    for (const each of media) kinds.set(`${each.media_product_type}/${each.media_type}`, (kinds.get(`${each.media_product_type}/${each.media_type}`) ?? 0) + 1);
    console.log(`  kinds: ${[...kinds].map(([kind, count]) => `${kind} x${count}`).join(", ") || "none"}`);

    const reels = media.filter((each) => each.media_product_type === "REELS");
    for (const reel of reels.slice(0, 5)) {
      const inLink = !!reel.shortcode && !!reel.permalink && new URL(reel.permalink).pathname.split("/").includes(reel.shortcode);
      console.log(
        `  reel: short code returned ${!!reel.shortcode} | link returned ${!!reel.permalink} (${reel.permalink ? new URL(reel.permalink).pathname.split("/")[1] : "-"}) | short code is in the link ${inLink} | date ${reel.timestamp ?? "none"} | caption ${reel.caption === undefined ? "none" : `${reel.caption.length} characters`} | video address returned ${!!reel.media_url}`,
      );
    }
    expect(reels.length).toBeGreaterThan(0);
  });

  test("one Reel's video: fetched from the address Instagram gave, with no token, and its length read", async () => {
    const listing = await read("/me/media", { fields: FIELDS, limit: "100", access_token: need(token, "INSTAGRAM_TEST_TOKEN") });
    if (!listing.ok) throw new Error(`Instagram refused: ${listing.status} ${listing.why}`);
    const reels = ((listing.body.data ?? []) as Media[]).filter((each) => each.media_product_type === "REELS");
    const withVideo = reels.find((each) => each.media_url);
    console.log(`  Reels with a video address: ${reels.filter((each) => each.media_url).length} of ${reels.length} (one without is what licensed music is said to look like)`);
    if (!withVideo?.media_url) throw new Error("No Reel on this account came back with a video address.");

    const address = new URL(withVideo.media_url);
    const head = await fetch(address, { headers: { range: "bytes=0-15" }, signal: AbortSignal.timeout(20_000) });
    console.log(`  the address: ${address.protocol}//…${address.hostname.split(".").slice(-2).join(".")} | fetched without a token: ${head.status} | type ${head.headers.get("content-type")} | size ${head.headers.get("content-range")?.split("/")[1] ?? "not said"} bytes`);
    // The service's own reader, as the live check would use it: over https only.
    const probed = await createFfmpegMedia().probe(withVideo.media_url);
    console.log(`  read as a video by the service's own reader: ${JSON.stringify(probed)}`);

    // One media read by its id, as the live check reads the recorded Reel.
    const one = await read(`/${withVideo.id}`, { fields: FIELDS, access_token: need(token, "INSTAGRAM_TEST_TOKEN") });
    console.log(`  the same Reel read by its id: ${one.ok ? `fields ${Object.keys(one.body).join(", ")}` : `refused ${one.status} ${one.why}`}`);
    expect(address.protocol).toBe("https:");
    expect(probed).toMatchObject({ durationSec: expect.any(Number) });
  });

  test("the token: whether it can be renewed, and for how long", async () => {
    const renewed = await read("/refresh_access_token", { grant_type: "ig_refresh_token", access_token: need(token, "INSTAGRAM_TEST_TOKEN") });

    if (renewed.ok) {
      const days = typeof renewed.body.expires_in === "number" ? Math.round(renewed.body.expires_in / 86_400) : "?";
      console.log(`  renewed: lasts ${days} days | a new token was given: ${typeof renewed.body.access_token === "string" && renewed.body.access_token !== token} | fields ${Object.keys(renewed.body).join(", ")}`);
    } else {
      // A token under a day old cannot be renewed yet. What Instagram answers then is itself a finding.
      console.log(`  not renewed: ${renewed.status} ${renewed.why}`);
    }
    expect(renewed.ok || renewed.status >= 400).toBe(true);
  });

  test("a token that is not one: what lost access looks like", async () => {
    const lost = await read("/me", { fields: "user_id", access_token: "not-a-real-token" });

    console.log(`  a bad token answers: ${lost.ok ? "accepted?!" : `${lost.status} ${lost.why}`}`);
    expect(lost.ok).toBe(false);
  });
});

describe("IG-FR-01 the connection itself", () => {
  test("the sign-in address to open in a browser, and the exchange of the code it comes back with", async () => {
    if (!appId || !appSecret || !redirectUri) {
      console.log("  skipped: set INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET and INSTAGRAM_REDIRECT_URI to try the connection.");
      return;
    }
    const signIn = `https://www.instagram.com/oauth/authorize?${new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, response_type: "code", scope: "instagram_business_basic", state: "by-hand" })}`;
    console.log(`  open this as the tester, approve, and copy the code from the address you land on:\n    ${signIn}`);
    if (!code) {
      console.log("  then set INSTAGRAM_TEST_CODE to that code and run this again to try the exchange.");
      return;
    }

    const exchange = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: new URLSearchParams({ client_id: appId, client_secret: appSecret, grant_type: "authorization_code", redirect_uri: redirectUri, code: code.replace(/#_$/, "") }),
      signal: AbortSignal.timeout(20_000),
    });
    const short = (await exchange.json().catch(() => ({}))) as { access_token?: string; user_id?: unknown; permissions?: unknown; error_message?: string };
    console.log(`  code exchanged: ${exchange.status} | token returned ${!!short.access_token} | account id returned ${short.user_id !== undefined} | permissions ${JSON.stringify(short.permissions ?? "not said")}${short.error_message ? ` | ${safe(short.error_message)}` : ""}`);
    if (!short.access_token) throw new Error("Instagram did not exchange the code. It works once and only for a short time: get a fresh one.");

    const long = await read("/access_token", { grant_type: "ig_exchange_token", client_secret: appSecret, access_token: short.access_token });
    console.log(
      `  exchanged for a long one: ${long.ok ? `lasts ${typeof long.body.expires_in === "number" ? Math.round(long.body.expires_in / 86_400) : "?"} days | fields ${Object.keys(long.body).join(", ")}` : `refused ${long.status} ${safe(long.why.split(short.access_token).join("<hidden>"))}`}`,
    );
    expect(long.ok).toBe(true);
  });
});
