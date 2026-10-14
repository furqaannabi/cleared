/**
 * The creator's account, through the app (deal set-up spec). Each test acts as a browser would: it sends
 * the cookies it was given and the address it is on, and checks what comes back.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { FakeGoogle, type Person } from "../test/fake-google";
import { createAccounts } from "./accounts/accounts";
import { createApp } from "./app";
import { prisma } from "./db";
import { localSecrets } from "./secrets/secrets";
import { createSessions } from "./sessions/sessions";

const APP = "https://app.sponing.test";
const API = "https://api.sponing.test";
const sam: Person = { googleId: "google-1", name: "Sam Rivera", email: "sam@example.com", channel: null };
const at = (iso: string) => new Date(iso);

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.connectedAccount.deleteMany();
  await prisma.creator.deleteMany();
  await prisma.job.deleteMany();
});

/** The app with a clock the test moves by hand, and one browser that keeps the cookies it is given. */
function setUp(startAt = "2026-10-09T09:00:00Z") {
  let now = at(startAt);
  const google = new FakeGoogle();
  const app = createApp({ prisma, appOrigin: APP, apiOrigin: API, now: () => now, google, secrets: localSecrets(Buffer.alloc(32, 7).toString("base64")) });
  const cookies = new Map<string, string>();

  /** Sends a request as the browser on Sponing's own app would, and keeps any cookie set in the answer. */
  async function send(method: string, path: string, options: { body?: unknown; origin?: string | null; form?: boolean } = {}) {
    const headers = new Headers();
    const origin = options.origin === undefined ? APP : options.origin;
    if (origin) headers.set("origin", origin);
    if (cookies.size) headers.set("cookie", [...cookies].map(([name, value]) => `${name}=${value}`).join("; "));
    let body: string | undefined;
    if (options.form) headers.set("content-type", "application/x-www-form-urlencoded");
    else if (options.body !== undefined) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(options.body);
    }
    const response = await app.request(path, { method, headers, body });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair = "", ...attributes] = cookie.split("; ");
      const [name = "", value = ""] = pair.split("=");
      if (value === "" || attributes.some((attribute) => attribute.toLowerCase() === "max-age=0")) cookies.delete(name);
      else cookies.set(name, value);
    }
    return response;
  }

  return {
    send,
    cookies,
    /** Signs this browser in as a creator who came through Google, without the trip to Google. */
    async signInWithGoogle(google = { googleId: "google-1", name: "Sam Rivera", email: "sam@example.com" }) {
      const { creatorId } = await createAccounts({ prisma, now: () => now }).signInWithGoogle(google);
      cookies.set("sponing_session", await createSessions({ prisma, now: () => now }).start(creatorId));
      return creatorId;
    },
    /** Signs this browser in the way a person does: to Google, approve, and back. The answer is the one that sets the session. */
    async signIn(query = "", person: Person = sam) {
      const start = await send("GET", `/auth/google${query}`);
      const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
      return send("GET", `/auth/google/callback?code=${google.approve(state, person)}&state=${state}`);
    },
    timeIs: (iso: string) => {
      now = at(iso);
    },
  };
}

describe("DS 1.2 there are no demo accounts: every creator signs in with Google", () => {
  test("the old demo button signs nobody in and makes no creator, however it is pressed", async () => {
    const browser = setUp();

    const asForm = await browser.send("POST", "/auth/demo", { form: true });
    const asJson = await browser.send("POST", "/auth/demo", { body: {} });

    expect(asForm.status).toBe(415);
    expect(asJson.status).toBe(404);
    expect(browser.cookies.has("sponing_session")).toBe(false);
    expect(await prisma.creator.count()).toBe(0);
  });

  test("DS-FR-08 who is signed in no longer says whether the account is a demo", async () => {
    const browser = setUp();
    await browser.signIn();

    expect(await (await browser.send("GET", "/me")).json()).not.toHaveProperty("demo");
  });

  test("signing in schedules nothing: no account is ever deleted on a timer", async () => {
    const browser = setUp();
    await browser.signIn();

    expect(await prisma.job.count()).toBe(0);
    expect(createAccounts({ prisma, now: () => new Date() })).not.toHaveProperty("handlers");
  });
});

describe("DS-FR-08 who is signed in", () => {
  test("with no session the answer is 401, in the one error shape (DS-FR-48)", async () => {
    const browser = setUp();

    const response = await browser.send("GET", "/me");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: "signed_out" } });
  });

  test("a cookie nobody was given signs nobody in", async () => {
    const browser = setUp();
    browser.cookies.set("sponing_session", "made-up-token");

    expect((await browser.send("GET", "/me")).status).toBe(401);
  });
});

describe("DS-BR-02 the session", () => {
  test("the cookie cannot be read by the page, is sent only over HTTPS, and is SameSite=Lax", async () => {
    const browser = setUp();

    const response = await browser.signIn();

    const cookie = response.headers.getSetCookie().find((entry) => entry.startsWith("sponing_session="))!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });

  test("the database keeps a hash of the token, never the token", async () => {
    const browser = setUp();
    await browser.signIn();

    const token = browser.cookies.get("sponing_session")!;
    const stored = JSON.stringify(await prisma.session.findMany());

    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(stored).not.toContain(token);
  });

  test("the token is in no response body or address", async () => {
    const browser = setUp();
    const response = await browser.signIn();
    const token = browser.cookies.get("sponing_session")!;

    expect(response.headers.get("location")).not.toContain(token);
    expect(await (await browser.send("GET", "/me")).text()).not.toContain(token);
  });
});

describe("DS-FR-03 how long a session lasts", () => {
  test("14 days from its last use: using it keeps it alive", async () => {
    const browser = setUp("2026-10-09T09:00:00Z");
    await browser.signIn();

    browser.timeIs("2026-10-22T09:00:00Z");
    expect((await browser.send("GET", "/me")).status).toBe(200);
    // 26 days after signing in, and 13 after it was last used.
    browser.timeIs("2026-11-04T09:00:00Z");
    expect((await browser.send("GET", "/me")).status).toBe(200);
  });

  test("left unused for 14 days, it signs nobody in", async () => {
    const browser = setUp("2026-10-09T09:00:00Z");
    await browser.signIn();

    browser.timeIs("2026-10-23T09:00:00Z");

    expect((await browser.send("GET", "/me")).status).toBe(401);
  });
});

describe("DS-FR-05 sign out", () => {
  test("ends the session and clears the cookie", async () => {
    const browser = setUp();
    await browser.signIn();

    const response = await browser.send("POST", "/auth/sign-out");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
    expect(browser.cookies.has("sponing_session")).toBe(false);
    expect(await prisma.session.count()).toBe(0);
  });

  test("the same cookie sent again signs nobody in", async () => {
    const browser = setUp();
    await browser.signIn();
    const token = browser.cookies.get("sponing_session")!;
    await browser.send("POST", "/auth/sign-out");

    browser.cookies.set("sponing_session", token);

    expect((await browser.send("GET", "/me")).status).toBe(401);
  });

  test("signing out when nobody is signed in is not an error", async () => {
    const browser = setUp();

    expect((await browser.send("POST", "/auth/sign-out")).status).toBe(200);
  });
});

describe("DS-FR-02 the first sign-in makes the creator", () => {
  test("a Google account not seen before becomes a new creator, who has not seen the welcome", async () => {
    const browser = setUp();
    await browser.signInWithGoogle();

    expect(await (await browser.send("GET", "/me")).json()).toEqual({
      name: "Sam Rivera",
      email: "sam@example.com",
      welcomed: false,
      accounts: [],
    });
  });

  test("the same Google account signs into the same creator", async () => {
    const first = await setUp().signInWithGoogle();
    const again = await setUp().signInWithGoogle();
    const someoneElse = await setUp().signInWithGoogle({ googleId: "google-2", name: "Mo", email: "mo@example.com" });

    expect(again).toBe(first);
    expect(someoneElse).not.toBe(first);
    expect(await prisma.creator.count()).toBe(2);
  });
});

describe("DS-FR-09 welcome seen", () => {
  test("it is recorded, and stays recorded", async () => {
    const browser = setUp();
    await browser.signInWithGoogle();

    const response = await browser.send("POST", "/me/welcomed");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ welcomed: true });
    expect(await (await browser.send("GET", "/me")).json()).toMatchObject({ welcomed: true });
  });

  test("it needs a session", async () => {
    expect((await setUp().send("POST", "/me/welcomed")).status).toBe(401);
  });
});

describe("DS-FR-10 the PayPal email", () => {
  test("the creator saves the email they are paid at", async () => {
    const browser = setUp();
    await browser.signInWithGoogle();

    const response = await browser.send("PUT", "/me/paypal-email", { body: { email: "sam-paypal@example.com" } });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ paypalEmail: "sam-paypal@example.com" });
  });

  test.each([
    ["not an email", { email: "not-an-email" }],
    ["missing", {}],
    ["far too long", { email: `${"a".repeat(250)}@example.com` }],
    ["not text", { email: 42 }],
  ])("an email that is %s is refused, naming the field, and nothing is saved", async (_, body) => {
    const browser = setUp();
    await browser.signInWithGoogle();

    const response = await browser.send("PUT", "/me/paypal-email", { body });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: "invalid", field: "email" } });
    expect(await (await browser.send("GET", "/me")).json()).not.toHaveProperty("paypalEmail");
  });

  test("it needs a session, and one creator cannot set another's", async () => {
    expect((await setUp().send("PUT", "/me/paypal-email", { body: { email: "x@example.com" } })).status).toBe(401);

    const sam = setUp();
    await sam.signInWithGoogle();
    const mo = setUp();
    await mo.signInWithGoogle({ googleId: "google-2", name: "Mo", email: "mo@example.com" });
    await mo.send("PUT", "/me/paypal-email", { body: { email: "mo-paypal@example.com" } });

    expect(await (await sam.send("GET", "/me")).json()).not.toHaveProperty("paypalEmail");
  });
});

describe("DS-BR-03 changing requests come only from Sponing's own app", () => {
  test.each([
    ["another site", "https://evil.example"],
    ["a look-alike address", "https://app.sponing.test.evil.example"],
    ["no origin at all", null],
  ])("a changing request from %s is refused and changes nothing", async (_, origin) => {
    const browser = setUp();
    await browser.signInWithGoogle();

    const response = await browser.send("PUT", "/me/paypal-email", { body: { email: "attacker@example.com" }, origin });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { code: "wrong_origin" } });
    expect(await (await browser.send("GET", "/me")).json()).not.toHaveProperty("paypalEmail");
  });

  test("no route takes a form: one posted from the app's own address is refused like any body that is not JSON", async () => {
    const browser = setUp();
    await browser.signInWithGoogle();

    const response = await browser.send("POST", "/auth/sign-out", { form: true });

    expect(response.status).toBe(415);
    expect((await browser.send("GET", "/me")).status).toBe(200);
  });

  test("reading needs no origin, so a page opened directly still loads", async () => {
    const browser = setUp();
    await browser.signInWithGoogle();

    expect((await browser.send("GET", "/me", { origin: null })).status).toBe(200);
  });

  test("a body that is not JSON is refused", async () => {
    const browser = setUp();
    await browser.signInWithGoogle();
    const cookie = `sponing_session=${browser.cookies.get("sponing_session")}`;
    const app = createApp({ prisma, appOrigin: APP });

    const response = await app.request("/me/paypal-email", {
      method: "PUT",
      headers: { origin: APP, cookie, "content-type": "text/plain" },
      body: JSON.stringify({ email: "sam-paypal@example.com" }),
    });

    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({ error: { code: "not_json" } });
  });
});

describe("the app's address is the only one browsers will let call the API with a session", () => {
  const preflight = (origin: string) =>
    createApp({ prisma, appOrigin: APP }).request("/me/paypal-email", {
      method: "OPTIONS",
      headers: { origin, "access-control-request-method": "PUT", "access-control-request-headers": "content-type" },
    });

  test("the app's address is allowed, with credentials", async () => {
    const response = await preflight(APP);

    expect(response.headers.get("access-control-allow-origin")).toBe(APP);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    expect(response.headers.get("access-control-allow-methods")).toContain("PUT");
  });

  test("any other address is not", async () => {
    const response = await preflight("https://evil.example");

    expect(response.headers.get("access-control-allow-origin")).not.toBe("https://evil.example");
    expect(response.headers.get("access-control-allow-origin")).not.toBe("*");
  });
});

describe("DS-FR-04 back where they were going", () => {
  /** A browser whose creator has signed in before and seen the welcome, so a sign-in lands where they were going. */
  async function returning() {
    const browser = setUp();
    await browser.signIn();
    await browser.send("POST", "/me/welcomed");
    return browser;
  }

  test("a path on Sponing's own app is used", async () => {
    const response = await (await returning()).signIn("?next=%2Fdeals%2Fabc%3Ftab%3Dfix");

    expect(response.headers.get("location")).toBe(`${APP}/deals/abc?tab=fix`);
  });

  test.each([
    ["another site", "https://evil.example/deals"],
    ["an address with no scheme", "//evil.example/deals"],
    ["a backslash trick", "/\\\\evil.example"],
    ["not a path", "deals"],
    ["something with a line break in it", "/deals\\r\\nSet-Cookie: x=1"],
  ])("%s is dropped, and the visitor lands on the default page", async (_, next) => {
    const response = await (await returning()).signIn(`?next=${encodeURIComponent(next)}`);

    expect(response.headers.get("location")).toBe(`${APP}/deals`);
  });
});
