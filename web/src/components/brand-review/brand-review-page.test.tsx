import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { describe, expect, test } from "vitest";
import { apiBaseUrl } from "@/lib/api";
import { aJuniperDeal } from "@/test/brand-deal";
import { juniperReel, juniperShort, juniperVideo, stubReview } from "@/test/juniper-review";
import { server } from "@/test/server";
import { apiError, recordRequests, stubBrandDeal, type BrandPost } from "@/test/stub-api";
import { BrandReviewPage } from "./brand-review-page";

const DEAL = "deal_juniper";
type Item = NonNullable<BrandPost["draft"]>["items"][number];
const now = () => new Date().toISOString();
const later = () => new Date(Date.now() + 40 * 3_600_000).toISOString();
const withItems = (p: BrandPost, change: (i: Item) => Item): BrandPost => ({ ...p, draft: { ...p.draft!, items: p.draft!.items.map(change) } });

/** Juniper & Salt's deal opened from its link, on one post's review; any other post isn't in the deal. */
async function openPost(post: BrandPost, heading: string) {
  stubBrandDeal(aJuniperDeal());
  server.use(http.get(`${apiBaseUrl}/brand/deals/${DEAL}/deliverables/:id`, () => apiError({ code: "not_found" }, 404)));
  const review = stubReview(post);
  render(<BrandReviewPage dealId={DEAL} deliverableId={post.deliverableId} />);
  await screen.findByRole("heading", { level: 1, name: heading });
  return review;
}
const review = () => screen.getByRole("region", { name: "Your review" });
const checklist = () => screen.getByRole("region", { name: "Checklist" });
const card = (name: string) => within(checklist()).getByRole("button", { name: new RegExp(`^${name}`) }).closest("li")!;

describe("RW-FR-04, RW-FR-05 getting in", () => {
  test("without a session, asks for the link again and never offers sign-in", async () => {
    server.use(http.get(`${apiBaseUrl}/brand/deals/${DEAL}`, () => apiError({ code: "signed_out" }, 401)));
    server.use(http.get(`${apiBaseUrl}/brand/deals/${DEAL}/deliverables/:id`, () => apiError({ code: "signed_out" }, 401)));
    render(<BrandReviewPage dealId={DEAL} deliverableId="del_juniper_video" />);
    expect(await screen.findByRole("heading", { name: "Open the link you were sent again" })).toBeVisible();
    expect(screen.queryByText(/sign in/i)).toBeNull();
  });

  test("a post that isn't in the deal says so", async () => {
    stubBrandDeal(aJuniperDeal());
    server.use(http.get(`${apiBaseUrl}/brand/deals/${DEAL}/deliverables/:id`, () => apiError({ code: "not_found" }, 404)));
    render(<BrandReviewPage dealId={DEAL} deliverableId="del_glow_video" />);
    expect(await screen.findByRole("heading", { name: "We couldn’t find this post" })).toBeVisible();
  });
});

describe("RW-FR-07, RW-FR-10, RW-FR-15 the window", () => {
  test("the frame, a crumb back to the deal, the time left, the hold, and each item in the brand's words", async () => {
    await openPost(juniperVideo(), "YouTube video");
    expect(screen.getByText(/invited/).textContent).toBe("Ada Okafor invited Juniper & Salt");
    expect(screen.getByRole("link", { name: "Juniper & Salt × Ada Okafor" })).toHaveAttribute("href", "/brand/deals/deal_juniper");
    expect(within(review()).getByText(/^31h 1[12]m$/)).toBeVisible();
    expect(within(review()).getByText("If you say nothing, the draft is approved.")).toBeVisible();
    expect(screen.getByText(/Held · \$1,500\.00/)).toBeVisible();
    expect(within(card("Bath salts shown dissolving in water")).getByText("You accepted")).toBeVisible();
    expect(within(card("juniperandsalt.com/ada in the description")).getByText("At live check")).toBeVisible();
    expect(screen.queryByText("Suggested fix")).toBeNull();
  });

  test("RW-FR-17, RW-FR-18, RW-FR-21: object to an item with a note, confirm, and the clock stops", async () => {
    const user = userEvent.setup();
    const post = await openPost(juniperVideo(), "YouTube video");
    post.on("post", "/objections", (p, { body }) => {
      const notes = new Map((body as { objections: { itemId: string; note: string }[] }).objections.map((o) => [o.itemId, o.note]));
      return { ...withItems(p, (i) => (notes.has(i.id) ? { ...i, status: "objected", note: notes.get(i.id) } : i)), review: { state: "objected", objectedAt: now() } };
    });
    const sent = recordRequests();
    await user.click(within(checklist()).getByRole("button", { name: /^Say the code TIDE15/ }));
    await user.click(screen.getByRole("button", { name: "Object to Say the code TIDE15" }));
    await user.click(screen.getByRole("button", { name: "Save objection" }));
    expect(screen.getByText("Say what’s wrong with this item.")).toBeVisible();
    await user.type(screen.getByRole("textbox", { name: "What’s wrong with Say the code TIDE15?" }), "Say it slower.");
    await user.click(screen.getByRole("button", { name: "Save objection" }));
    expect(within(review()).getByText("Say it slower.")).toBeVisible();

    await user.click(within(review()).getByRole("button", { name: "Send 1 objection to Ada Okafor" }));
    expect(within(review()).getByText(/Send 1 objection\?/)).toBeVisible();
    await user.click(within(review()).getByRole("button", { name: "Yes, send" }));
    expect(await within(review()).findByText("You asked Ada Okafor to fix 1 item.")).toBeVisible();
    expect(within(review()).getByRole("button", { name: "Approve this draft anyway" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Object to/ })).toBeNull();
    expect(sent).toContainEqual({
      method: "POST",
      path: "/brand/deals/deal_juniper/deliverables/del_juniper_video/objections",
      body: { objections: [{ itemId: "jv_3", note: "Say it slower." }] },
    });
  });

  test("RW-FR-16: approving asks first, in place, and says what it means for the money", async () => {
    const user = userEvent.setup();
    const post = await openPost(juniperVideo(), "YouTube video");
    post.on("post", "/approve", (p) => ({ ...p, review: { state: "approved", approvedAt: now(), by: "brand" } }));
    await user.click(within(review()).getByRole("button", { name: "Approve draft" }));
    expect(within(review()).getByText(/Your \$1,500\.00 is taken only once the live post checks out\./)).toBeVisible();
    await user.click(within(review()).getByRole("button", { name: "Not yet" }));
    await user.click(within(review()).getByRole("button", { name: "Approve draft" }));
    await user.click(within(review()).getByRole("button", { name: "Yes, approve" }));
    expect(await within(review()).findByText(/^Approved by you · /)).toBeVisible();
  });

  test("RW-FR-20: a window that ended while objections were being written: approved, and the notes stay to copy", async () => {
    const user = userEvent.setup();
    await openPost(juniperVideo(), "YouTube video");
    await user.click(within(checklist()).getByRole("button", { name: /^Say the code TIDE15/ }));
    await user.click(screen.getByRole("button", { name: "Object to Say the code TIDE15" }));
    await user.type(screen.getByRole("textbox", { name: "What’s wrong with Say the code TIDE15?" }), "Say it slower.");
    await user.click(screen.getByRole("button", { name: "Save objection" }));
    // The window ends now: sending is too late, and the post reads as approved by the window.
    stubReview(juniperVideo({}, { state: "approved", approvedAt: now(), by: "window" }));
    server.use(http.post(`${apiBaseUrl}/brand/deals/${DEAL}/deliverables/del_juniper_video/objections`, () => apiError({ code: "window_ended" }, 409)));
    await user.click(within(review()).getByRole("button", { name: "Send 1 objection to Ada Okafor" }));
    await user.click(within(review()).getByRole("button", { name: "Yes, send" }));
    expect(await within(review()).findByText(/so this draft is approved\. Your objections weren’t sent\./)).toBeVisible();
    expect(within(review()).getByText("Say it slower.")).toBeVisible();
    expect(within(review()).getByText("Approved · No objection in 48 hours")).toBeVisible();
  });
});

describe("RW-FR-12 to RW-FR-14 answering an ask", () => {
  test("the asked item is open first; accepting the last one starts the window", async () => {
    const user = userEvent.setup();
    const post = await openPost(juniperReel(), "Instagram Reel");
    post.on("post", "/items/:itemId/accept", (p, { params }) => ({
      ...withItems(p, (i) => (i.id === params.itemId ? { ...i, status: "accepted" } : i)),
      review: { state: "window", endsAt: later() },
    }));
    expect(within(review()).getByText("Ada Okafor asked you to accept 1 item.")).toBeVisible();
    const asked = card("Bath salts shown dissolving in water");
    expect(within(asked).getByRole("button", { name: /^Bath salts/ })).toHaveAttribute("aria-expanded", "true");
    await user.click(within(asked).getByRole("button", { name: "Accept" }));
    expect(await within(review()).findByText(/^Every item passed\./)).toBeVisible();
  });

  test("asking Ada to fix it, with an optional note", async () => {
    const user = userEvent.setup();
    const post = await openPost(juniperReel(), "Instagram Reel");
    post.on("post", "/items/:itemId/fix", (p, { body, params }) =>
      withItems(p, (i) => (i.id === params.itemId ? { ...i, status: "fix_requested", note: (body as { note?: string }).note } : i)),
    );
    const sent = recordRequests();
    const asked = card("Bath salts shown dissolving in water");
    await user.click(within(asked).getByRole("button", { name: "Ask Ada Okafor to fix it" }));
    await user.type(within(asked).getByRole("textbox", { name: "A note for Ada Okafor (optional)" }), "Let them fully dissolve.");
    await user.click(within(asked).getByRole("button", { name: "Send to Ada Okafor" }));
    expect(await within(card("Bath salts shown dissolving in water")).findByText("You asked for a fix")).toBeVisible();
    expect(within(review()).getByText("You answered Ada Okafor.")).toBeVisible();
    expect(sent.at(-1)?.body).toEqual({ note: "Let them fully dissolve." });
  });
});

describe("RW-FR-06, RW-FR-22 nothing to see yet, and approved", () => {
  test("before an ask or the window, no draft is shown", async () => {
    const { draft: _, ...checking } = juniperShort({}, { state: "nothing_yet" });
    void _;
    await openPost(checking, "YouTube Short");
    expect(screen.getByText("Ada Okafor is working on the draft.")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Checklist" })).toBeNull();
  });

  test("an approved draft says who posts next and when the money is taken; no actions", async () => {
    await openPost(juniperShort(), "YouTube Short");
    expect(within(review()).getByText(/^Approved by you · /)).toBeVisible();
    expect(within(review()).getByText(/Ada Okafor posts by .+\. Your \$350\.00 is taken only once the live post checks out\./)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Approve|Object/ })).toBeNull();
  });
});

describe("PP-FR-26 to PP-FR-30 after posting", () => {
  /** The Short, published, with the live check's answer for the brand. */
  const posted = (state: BrandPost["review"]) =>
    juniperShort({ post: { url: "https://www.youtube.com/watch?v=tideshort01", items: [] }, cancel: { allowed: false, reason: "published" } }, state);
  const taken = (p: BrandPost): BrandPost => ({ ...p, review: { state: "taken", amount: "350.00", reference: "CAP-9KM43156NP", at: now(), creatorPaid: false } });

  test("couldn't decide: the live post, why, the silence line; confirming takes the money", async () => {
    const user = userEvent.setup();
    const post = await openPost(posted({ state: "confirm", endsAt: later(), what: ["paid_promotion"] }), "YouTube Short");
    post.on("post", "/post/confirm", taken);
    expect(screen.getByRole("link", { name: "View the live post" })).toHaveAttribute("href", "https://www.youtube.com/watch?v=tideshort01");
    expect(within(review()).getByText(/If you say nothing by .+, Ada Okafor is paid\./)).toBeVisible();
    await user.click(within(review()).getByRole("button", { name: "Confirm the post" }));
    expect(within(review()).getByText(/Your \$350\.00 is taken and Ada Okafor is paid\./)).toBeVisible();
    await user.click(within(review()).getByRole("button", { name: "Yes, confirm" }));
    expect(await within(review()).findByText(/Ada Okafor’s payment is on its way\./)).toBeVisible();
  });

  test("objecting needs a reason, then a person at Cleared decides", async () => {
    const user = userEvent.setup();
    const post = await openPost(posted({ state: "confirm", endsAt: later(), what: ["paid_promotion"] }), "YouTube Short");
    post.on("post", "/post/object", (p, { body }) => ({ ...p, review: { state: "with_cleared", reason: (body as { reason: string }).reason, ruleBy: later() } }));
    await user.click(within(review()).getByRole("button", { name: "Object" }));
    await user.click(within(review()).getByRole("button", { name: "Send objection" }));
    expect(within(review()).getByText("Say why you’re objecting.")).toBeVisible();
    await user.type(within(review()).getByRole("textbox", { name: "Why are you objecting?" }), "The label isn’t on.");
    await user.click(within(review()).getByRole("button", { name: "Send objection" }));
    expect(await within(review()).findByText("A person at Cleared is deciding")).toBeVisible();
  });

  test("failed for good: accept the post anyway, after a confirmation; silence returns the money", async () => {
    const user = userEvent.setup();
    const post = await openPost(posted({ state: "accept", endsAt: later(), reason: "not_the_approved_file" }), "YouTube Short");
    post.on("post", "/post/accept", (p) => ({ ...taken(p), review: { ...(taken(p).review as object), creatorPaid: true } as BrandPost["review"] }));
    expect(within(review()).getByText(/If you don’t accept it by .+, the hold comes back to you\./)).toBeVisible();
    await user.click(within(review()).getByRole("button", { name: "Accept the post anyway" }));
    await user.click(within(review()).getByRole("button", { name: "Yes, accept" }));
    expect(await within(review()).findByText("Paid")).toBeVisible();
  });
});

describe("CN-FR-01, CN-FR-04, CN-FR-10 the brand cancels a post (design B)", () => {
  test("the hold turns over to confirm; cancelling brings the money back and says so", async () => {
    const user = userEvent.setup();
    const post = await openPost(juniperReel(), "Instagram Reel");
    const cancelled = (p: BrandPost, note?: string): BrandPost => ({
      ...p,
      review: { state: "released", releasedAt: now(), reason: "cancelled" },
      cancel: { allowed: false, reason: "finished" },
      cancelled: { by: "brand", at: now(), ...(note ? { note } : {}) },
    });
    post.on("post", "/cancel", (p, { body }) => cancelled(p, (body as { note?: string }).note));
    await user.click(screen.getAllByRole("button", { name: "Cancel this post" })[0]);
    const confirm = screen.getByRole("region", { name: "Cancel this post?" });
    expect(confirm).toHaveTextContent("Would come back to you");
    expect(confirm).toHaveTextContent("$600.00");
    await user.type(within(confirm).getByRole("textbox", { name: "Add a note for Ada Okafor (optional)" }), "Pausing the campaign.");
    await user.click(within(confirm).getByRole("button", { name: "Cancel the post" }));
    expect((await screen.findAllByText(/Your \$600\.00 came back to you on \d+ \w+\. You cancelled this post\./)).length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "The hold" })).toHaveTextContent("Released · $600.00");
    expect(screen.queryByRole("button", { name: "Cancel this post" })).toBeNull();
  });

  test("CN-FR-03: with the creator's go-ahead running, the line says why", async () => {
    await openPost(juniperShort({ cancel: { allowed: false, reason: "go_ahead_running" } }, { state: "posting", postBy: later() }), "YouTube Short");
    expect((await screen.findAllByText("You can’t cancel now: Ada Okafor has the go-ahead to post.")).length).toBeGreaterThan(0);
  });
});
