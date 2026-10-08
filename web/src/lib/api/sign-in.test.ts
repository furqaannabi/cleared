import { describe, expect, test } from "vitest";
import { api } from "@/lib/api";

describe("SI-FR-04, SI-FR-14 who is signed in, on mocks", () => {
  test("signed out: /me and the deals answer signed_out", async () => {
    await api.signOut();
    expect(await api.getProfile()).toEqual({ ok: false, error: "signed_out" });
    expect(await api.getDeals()).toEqual({ ok: false, error: "signed_out" });
  });

  test("Sign in with Google, the first time: a new creator with no deals, sent to the welcome page", async () => {
    await api.signOut();
    expect(await api.mockSignIn("google")).toEqual({ ok: true, data: { location: "/welcome" } });
    expect(await api.getProfile()).toMatchObject({ ok: true, data: { name: "Sam Rivera", demo: false, welcomed: false, accounts: [] } });
    expect(await api.getDeals()).toEqual({ ok: true, data: [] });
  });

  test("SI-FR-10, SI-FR-03: once the welcome is seen, sign-in goes to the deals, or to where they were going", async () => {
    await api.signOut();
    await api.mockSignIn("google");
    expect((await api.markWelcomeSeen()).ok).toBe(true);
    await api.signOut();
    expect(await api.mockSignIn("google")).toEqual({ ok: true, data: { location: "/deals" } });
    await api.signOut();
    expect(await api.mockSignIn("google", "/deals/new")).toEqual({ ok: true, data: { location: "/deals/new" } });
  });

  test("SI-FR-02: Try the demo account signs in Ada with every seeded deal", async () => {
    await api.signOut();
    expect(await api.mockSignIn("demo")).toEqual({ ok: true, data: { location: "/deals" } });
    expect(await api.getProfile()).toMatchObject({ ok: true, data: { name: "Ada Okafor", demo: true, welcomed: true } });
    const deals = await api.getDeals();
    expect(deals.ok && deals.data.map((d) => d.id)).toContain("deal_juniper");
  });

  test("SI-BR-03: each account sees only its own deals", async () => {
    await api.signOut();
    await api.mockSignIn("google");
    const made = await api.createDeal({ brandName: "Fern Studio", deliverables: [{ platform: "youtube_video" }] });
    if (!made.ok) throw new Error(made.error);
    const sams = await api.getDeals();
    expect(sams.ok && sams.data.map((d) => d.id)).toEqual([made.data.id]);
    await api.signOut();
    await api.mockSignIn("demo");
    const adas = await api.getDeals();
    expect(adas.ok && adas.data.map((d) => d.id)).not.toContain(made.data.id);
  });
});
