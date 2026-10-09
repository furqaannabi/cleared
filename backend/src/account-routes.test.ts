/**
 * The creator's account, through the app (deal set-up spec). Each test acts as a browser would: it sends
 * the cookies it was given and the address it is on, and checks what comes back.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { createAccounts } from "./accounts/accounts";
import { createApp } from "./app";
import { prisma } from "./db";
import { runDueJobs } from "./jobs/jobs";
import { createSessions } from "./sessions/sessions";

const APP = "https://app.cleared.test";
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
  let address = "203.0.113.7";
  const app = createApp({ prisma, appOrigin: APP, now: () => now, clientAddress: () => address });
  const cookies = new Map<string, string>();

  /** Sends a request as the browser on Cleared's own app would, and keeps any cookie set in the answer. */
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
      cookies.set("cleared_session", await createSessions({ prisma, now: () => now }).start(creatorId));
      return creatorId;
    },
    /** Presses "Try the demo account", which is a form posted from the app. */
    tryDemo: (query = "") => send("POST", `/auth/demo${query}`, { form: true }),
    timeIs: (iso: string) => {
      now = at(iso);
    },
    /** Runs every job that is due at the clock's time, as the service's worker would. */
    runJobs: () => runDueJobs(prisma, createAccounts({ prisma, now: () => now }).handlers, { now, log: () => {} }),
    from: (other: string) => {
      address = other;
    },
  };
}

describe("DS-FR-06 try the demo account", () => {
  test("one press makes a demo creator, signs the browser in and sends it into the app", async () => {
    const browser = setUp();

    const response = await browser.tryDemo();

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${APP}/deals`);
    const me = await browser.send("GET", "/me");
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({
      name: expect.any(String),
      demo: true,
      welcomed: true,
      paypalEmail: expect.stringContaining("@"),
      accounts: [{ platform: "youtube", name: expect.any(String) }],
    });
  });

  test("each visitor gets their own demo creator", async () => {
    const first = setUp();
    const second = setUp();
    await first.tryDemo();
    await second.tryDemo();

    expect(await prisma.creator.count({ where: { demo: true } })).toBe(2);
    expect(first.cookies.get("cleared_session")).not.toBe(second.cookies.get("cleared_session"));
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
    browser.cookies.set("cleared_session", "made-up-token");

    expect((await browser.send("GET", "/me")).status).toBe(401);
  });
});

describe("DS-BR-02 the session", () => {
  test("the cookie cannot be read by the page, is sent only over HTTPS, and is SameSite=Lax", async () => {
    const browser = setUp();

    const response = await browser.tryDemo();

    const cookie = response.headers.getSetCookie().find((entry) => entry.startsWith("cleared_session="))!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });

  test("the database keeps a hash of the token, never the token", async () => {
    const browser = setUp();
    await browser.tryDemo();

    const token = browser.cookies.get("cleared_session")!;
    const stored = JSON.stringify(await prisma.session.findMany());

    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(stored).not.toContain(token);
  });

  test("the token is in no response body or address", async () => {
    const browser = setUp();
    const response = await browser.tryDemo();
    const token = browser.cookies.get("cleared_session")!;

    expect(response.headers.get("location")).not.toContain(token);
    expect(await (await browser.send("GET", "/me")).text()).not.toContain(token);
  });
});

describe("DS-FR-03 how long a session lasts", () => {
  test("14 days from its last use: using it keeps it alive", async () => {
    const browser = setUp("2026-10-09T09:00:00Z");
    await browser.tryDemo();

    browser.timeIs("2026-10-22T09:00:00Z");
    expect((await browser.send("GET", "/me")).status).toBe(200);
    // 26 days after signing in, and 13 after it was last used.
    browser.timeIs("2026-11-04T09:00:00Z");
    expect((await browser.send("GET", "/me")).status).toBe(200);
  });

  test("left unused for 14 days, it signs nobody in", async () => {
    const browser = setUp("2026-10-09T09:00:00Z");
    await browser.tryDemo();

    browser.timeIs("2026-10-23T09:00:00Z");

    expect((await browser.send("GET", "/me")).status).toBe(401);
  });
});

describe("DS-FR-05 sign out", () => {
  test("ends the session and clears the cookie", async () => {
    const browser = setUp();
    await browser.tryDemo();

    const response = await browser.send("POST", "/auth/sign-out");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
    expect(browser.cookies.has("cleared_session")).toBe(false);
    expect(await prisma.session.count()).toBe(0);
  });

  test("the same cookie sent again signs nobody in", async () => {
    const browser = setUp();
    await browser.tryDemo();
    const token = browser.cookies.get("cleared_session")!;
    await browser.send("POST", "/auth/sign-out");

    browser.cookies.set("cleared_session", token);

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
      demo: false,
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

describe("DS-BR-03 changing requests come only from Cleared's own app", () => {
  test.each([
    ["another site", "https://evil.example"],
    ["a look-alike address", "https://app.cleared.test.evil.example"],
    ["no origin at all", null],
  ])("a changing request from %s is refused and changes nothing", async (_, origin) => {
    const browser = setUp();
    await browser.signInWithGoogle();

    const response = await browser.send("PUT", "/me/paypal-email", { body: { email: "attacker@example.com" }, origin });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { code: "wrong_origin" } });
    expect(await (await browser.send("GET", "/me")).json()).not.toHaveProperty("paypalEmail");
  });

  test("a demo account cannot be started from another site", async () => {
    const browser = setUp();

    const response = await browser.send("POST", "/auth/demo", { form: true, origin: "https://evil.example" });

    expect(response.status).toBe(403);
    expect(await prisma.creator.count()).toBe(0);
  });

  test("reading needs no origin, so a page opened directly still loads", async () => {
    const browser = setUp();
    await browser.signInWithGoogle();

    expect((await browser.send("GET", "/me", { origin: null })).status).toBe(200);
  });

  test("a body that is not JSON is refused", async () => {
    const browser = setUp();
    await browser.signInWithGoogle();
    const cookie = `cleared_session=${browser.cookies.get("cleared_session")}`;
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
  test("a path on Cleared's own app is used", async () => {
    const response = await setUp().tryDemo("?next=%2Fdeals%2Fabc%3Ftab%3Dfix");

    expect(response.headers.get("location")).toBe(`${APP}/deals/abc?tab=fix`);
  });

  test.each([
    ["another site", "https://evil.example/deals"],
    ["an address with no scheme", "//evil.example/deals"],
    ["a backslash trick", "/\\\\evil.example"],
    ["not a path", "deals"],
    ["something with a line break in it", "/deals\\r\\nSet-Cookie: x=1"],
  ])("%s is dropped, and the visitor lands on the default page", async (_, next) => {
    const response = await setUp().tryDemo(`?next=${encodeURIComponent(next)}`);

    expect(response.headers.get("location")).toBe(`${APP}/deals`);
  });
});

describe("DS-FR-07 demo limits", () => {
  test("the eleventh demo account in an hour from one address is refused, and the visitor is told in the app", async () => {
    const browser = setUp("2026-10-09T09:00:00Z");
    for (let made = 0; made < 10; made++) await browser.tryDemo();

    const response = await browser.tryDemo();

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${APP}/sign-in?problem=demo_limit`);
    expect(await prisma.creator.count()).toBe(10);
  });

  test("another address is not affected, and the limit lifts after an hour", async () => {
    const browser = setUp("2026-10-09T09:00:00Z");
    for (let made = 0; made < 10; made++) await browser.tryDemo();

    browser.from("198.51.100.4");
    expect((await browser.tryDemo()).headers.get("location")).toBe(`${APP}/deals`);

    browser.from("203.0.113.7");
    browser.timeIs("2026-10-09T10:00:01Z");
    expect((await browser.tryDemo()).headers.get("location")).toBe(`${APP}/deals`);
  });

  test("the visitor's address itself is not kept", async () => {
    const browser = setUp();
    await browser.tryDemo();

    expect(JSON.stringify(await prisma.creator.findMany())).not.toContain("203.0.113.7");
  });
});

describe("DS-FR-07 a demo account is deleted after 7 days", () => {
  test("the creator, their session and their connected account all go", async () => {
    const browser = setUp("2026-10-09T09:00:00Z");
    await browser.tryDemo();

    browser.timeIs("2026-10-16T09:00:00Z");
    await browser.runJobs();

    expect(await prisma.creator.count()).toBe(0);
    expect(await prisma.session.count()).toBe(0);
    expect(await prisma.connectedAccount.count()).toBe(0);
    expect((await browser.send("GET", "/me")).status).toBe(401);
  });

  test("not before, and a creator who signed in with Google is never deleted", async () => {
    const demo = setUp("2026-10-09T09:00:00Z");
    await demo.tryDemo();
    const real = setUp("2026-10-09T09:00:00Z");
    await real.signInWithGoogle();

    demo.timeIs("2026-10-16T08:59:00Z");
    await demo.runJobs();
    expect(await prisma.creator.count()).toBe(2);

    demo.timeIs("2026-11-30T09:00:00Z");
    await demo.runJobs();
    expect(await prisma.creator.findMany()).toMatchObject([{ demo: false, name: "Sam Rivera" }]);
  });
});
