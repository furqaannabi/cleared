import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { apiBaseUrl } from "@/lib/api";
import type { Deliverable } from "@/lib/deliverable/types";
import { stubPosts } from "@/test/creator-posts";
import { juniperDeliverables } from "@/test/fixtures/juniper";
import { server } from "@/test/server";
import { DraftCheckPage } from "./draft-check-page";

const DEAL = "deal_juniper";
const LINK = { url: "https://sponing.example/b/review_del_juniper_video", expiresAt: "2026-10-14T12:00:00.000Z", expired: false };

/** Juniper & Salt's three posts as the creator reads them; the video, in its review window, has the brand's link. */
const juniper = (): Deliverable[] => juniperDeliverables(Date.now()).map((d) => (d.id === "del_juniper_video" ? { ...d, reviewLink: LINK } : d));
const post = (id: string) => juniper().find((d) => d.id === id)!;
beforeEach(() => void stubPosts(...juniper()));

describe("DC-FR-49, DC-FR-50 the brand objected", () => {
  test("names how many items and the deadline; the objected item says the check passed it, with the brand's note", async () => {
    const video = post("del_juniper_video");
    stubPosts({
      ...video,
      state: "objected",
      objectedAt: new Date().toISOString(),
      reviewWindowEndsAt: undefined,
      items: video.items.map((i) => (i.id === "jv_3" ? { ...i, status: "objected_by_brand", brandNote: "Say it slower." } : i)),
    });
    render(<DraftCheckPage dealId={DEAL} deliverableId="del_juniper_video" />);
    expect(await within(await screen.findByRole("region", { name: "What happens next" })).findByText(/^Juniper & Salt asked you to fix 1 item\. Upload a new draft by /)).toBeVisible();
    const checklist = screen.getByRole("region", { name: "Checklist" });
    const objected = within(checklist).getByRole("button", { name: /^Say the code TIDE15/ });
    expect(objected).toHaveAttribute("aria-expanded", "true");
    const card = objected.closest("li")!;
    expect(within(card).getAllByText("Juniper & Salt objected")[0]).toBeVisible();
    expect(within(card).getByText("The check passed this. Juniper & Salt asked you to change it:")).toBeVisible();
    expect(within(card).getByText("“Say it slower.”")).toBeVisible();
  });
});

describe("DC-FR-51 approved", () => {
  test("says the brand approved, and not to publish until the hold is confirmed; no upload", async () => {
    render(<DraftCheckPage dealId={DEAL} deliverableId="del_juniper_short" />);
    const banner = await screen.findByRole("region", { name: "Draft approved" });
    expect(banner).toHaveTextContent("Juniper & Salt approved this draft.");
    expect(within(banner).getByText("Don’t publish yet. Sponing confirms Juniper & Salt’s hold with PayPal first.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Upload/ })).toBeNull();
  });
});

describe("DC-FR-52 a link for the brand", () => {
  test("while the brand has something to do, the creator can copy it; never once the brand is done", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DraftCheckPage dealId={DEAL} deliverableId="del_juniper_video" />);
    await user.click(await screen.findByRole("button", { name: "Copy link for Juniper & Salt" }));
    expect(await screen.findByText("Copied")).toBeVisible();
    expect(await navigator.clipboard.readText()).toBe(LINK.url);
    unmount();
    render(<DraftCheckPage dealId={DEAL} deliverableId="del_juniper_short" />);
    await screen.findByRole("region", { name: "Draft approved" });
    expect(screen.queryByRole("button", { name: /Copy link/ })).toBeNull();
  });
});

describe("DC-FR-52 (1.18) the brand's link: opened, expired, made again", () => {
  const route = `${apiBaseUrl}/deliverables/del_juniper_video`;
  /** Juniper & Salt's video, with this test's review link. */
  async function withLink(link: { expired: boolean }, reviewOpenedAt?: string) {
    const post = {
      ...juniper().find((d) => d.id === "del_juniper_video")!,
      reviewLink: { url: "https://sponing.example/b/rev_juniper", expiresAt: "2026-10-14T12:00:00.000Z", ...link },
      ...(reviewOpenedAt ? { reviewOpenedAt } : {}),
    };
    server.use(http.get(route, () => HttpResponse.json(post)));
    return post;
  }

  test("says whether the brand has opened it, and never that it was emailed", async () => {
    await withLink({ expired: false });
    const { unmount } = render(<DraftCheckPage dealId={DEAL} deliverableId="del_juniper_video" />);
    expect(await screen.findByText("Juniper & Salt hasn’t opened it yet.")).toBeVisible();
    expect(screen.queryByText(/emailed/)).toBeNull();
    unmount();
    const opened = new Date(2026, 9, 11, 14, 5).toISOString();
    await withLink({ expired: false }, opened);
    render(<DraftCheckPage dealId={DEAL} deliverableId="del_juniper_video" />);
    expect(await screen.findByText("Juniper & Salt opened it on 11 Oct, 14:05.")).toBeVisible();
  });

  test("an expired link offers Make a new link, which makes one and copies it", async () => {
    const user = userEvent.setup();
    const post = await withLink({ expired: true });
    server.use(
      http.post(`${route}/review-link`, () =>
        HttpResponse.json({ ...post, reviewLink: { url: "https://sponing.example/b/rev_juniper_2", expiresAt: "2026-10-16T12:00:00.000Z", expired: false } }),
      ),
    );
    render(<DraftCheckPage dealId={DEAL} deliverableId="del_juniper_video" />);
    expect(await screen.findByText("This link has expired.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Copy link for Juniper & Salt" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Make a new link" }));
    expect(await screen.findByText("New link copied")).toBeVisible();
    expect(await navigator.clipboard.readText()).toBe("https://sponing.example/b/rev_juniper_2");
  });
});
