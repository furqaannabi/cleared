import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { BrandDealPage } from "@/components/brand-deal/brand-deal-page";
import { InvitePage } from "@/components/invite/invite-page";
import { stubMapleDeal } from "@/test/brand-deal";
import { aProfile, anInvite, recordRequests, stubDeals, stubSession } from "@/test/stub-api";
import { stubState } from "@/test/stub-state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

/** Marks one post cancelled by `by`, with the note sent, in an invite or a brand's deal. */
const cancelOne =
  (by: "creator" | "brand") =>
  <D extends { posts: { deliverableId: string; cancel?: unknown; cancelled?: { by: "creator" | "brand"; at: string; note?: string } }[] }>(d: D, { body, params }: { body: never; params: Record<string, string> }): D => ({
    ...d,
    posts: d.posts.map((p) => (p.deliverableId === params.deliverableId ? { ...p, cancel: { allowed: false as const, reason: "finished" as const }, cancelled: { by, at: new Date().toISOString(), ...((body as { note?: string } | undefined)?.note ? { note: (body as { note: string }).note } : {}) } } : p)),
  });

describe("CN-FR-02, CN-FR-06, CN-FR-11, CN-FR-14 the creator cancels the deal from the invite page", () => {
  test("a card per post, the note, then every post closed and the deal says so", async () => {
    const user = userEvent.setup();
    stubSession(aProfile({ paypalEmail: "ada@example.com" }));
    stubDeals([]);
    const invite = stubState(
      "/deals/deal_pine/invite",
      anInvite({
        posts: [
          { deliverableId: "del_pine_video", platform: "youtube_video", itemCount: 3, cancel: { allowed: true } },
          { deliverableId: "del_pine_reel", platform: "instagram_reel", itemCount: 2, cancel: { allowed: true } },
        ],
      }),
    );
    invite.on("post", "/posts/:deliverableId/cancel", cancelOne("creator"));
    render(<InvitePage dealId="deal_pine" />);
    await user.click(await screen.findByRole("button", { name: "Cancel the deal" }));
    const card = screen.getByRole("region", { name: "Cancel the deal?" });
    expect(within(card).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Closes · nothing is held yet"),
      expect.stringContaining("Closes · nothing is held yet"),
    ]);
    await user.type(within(card).getByRole("textbox", { name: "Add a note for Pine & Co (optional)" }), "Wrong brand.");
    await user.click(within(card).getByRole("button", { name: "Cancel the deal" }));
    expect(await screen.findByRole("heading", { name: "Cancelled before it was held" })).toBeVisible();
    expect(screen.getByText(/Nothing was taken\. You cancelled this deal on \d+ \w+\./)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Cancel the deal" })).toBeNull();
  });
});

describe("CN-FR-01, CN-FR-12, CN-FR-15 the brand cancels before agreeing", () => {
  test("one post from its line, then the rest with Cancel the deal; the creator's invite shows who and the note", async () => {
    const user = userEvent.setup();
    stubMapleDeal().on("post", "/posts/:deliverableId/cancel", cancelOne("brand"));
    const sent = recordRequests();
    render(<BrandDealPage dealId="deal_maple" />);
    const reel = await screen.findByRole("group", { name: "Instagram Reel" });
    await user.click(within(reel).getByRole("button", { name: "Cancel this post" }));
    await user.click(within(screen.getByRole("region", { name: "Cancel this post?" })).getByRole("button", { name: "Cancel the post" }));
    expect(await within(screen.getByRole("group", { name: "Instagram Reel" })).findByText("Cancelled · nothing held")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel the deal" }));
    const card = screen.getByRole("region", { name: "Cancel the deal?" });
    expect(within(card).getAllByRole("listitem")).toHaveLength(2);
    await user.type(within(card).getByRole("textbox", { name: "Add a note for Ada Okafor (optional)" }), "Plans changed.");
    await user.click(within(card).getByRole("button", { name: "Cancel the deal" }));
    expect(await screen.findByRole("heading", { name: "Cancelled before it was held" })).toBeVisible();
    expect(sent.filter((r) => r.method === "POST")).toEqual([
      { method: "POST", path: "/brand/deals/deal_maple/posts/del_maple_reel/cancel", body: {} },
      { method: "POST", path: "/brand/deals/deal_maple/posts/del_maple_video/cancel", body: { note: "Plans changed." } },
      { method: "POST", path: "/brand/deals/deal_maple/posts/del_maple_short/cancel", body: { note: "Plans changed." } },
    ]);
  });
});
