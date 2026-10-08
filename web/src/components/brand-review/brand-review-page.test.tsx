import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { api } from "@/lib/api";
import { endReviewWindow } from "@/mocks/demo-review";
import { findDeliverable } from "@/mocks/store";
import { BrandReviewPage } from "./brand-review-page";

const DEAL = "deal_juniper";

/** The seeded held deal (Juniper & Salt), opened from its link, on one post's review. */
async function openPost(deliverableId: string, heading: string) {
  await api.openBrandLink("demo_juniper");
  render(<BrandReviewPage dealId={DEAL} deliverableId={deliverableId} />);
  await screen.findByRole("heading", { level: 1, name: heading });
}
const review = () => screen.getByRole("region", { name: "Your review" });
const checklist = () => screen.getByRole("region", { name: "Checklist" });
const card = (name: string) => within(checklist()).getByRole("button", { name: new RegExp(`^${name}`) }).closest("li")!;

describe("RW-FR-04, RW-FR-05 getting in", () => {
  test("without a session, asks for the link again and never offers sign-in", async () => {
    render(<BrandReviewPage dealId={DEAL} deliverableId="del_juniper_video" />);
    expect(await screen.findByRole("heading", { name: "Open the link you were sent again" })).toBeVisible();
    expect(screen.queryByText(/sign in/i)).toBeNull();
  });

  test("a post that isn't in the deal says so", async () => {
    await api.openBrandLink("demo_juniper");
    render(<BrandReviewPage dealId={DEAL} deliverableId="del_glow_video" />);
    expect(await screen.findByRole("heading", { name: "We couldn’t find this post" })).toBeVisible();
  });
});

describe("RW-FR-07, RW-FR-10, RW-FR-15 the window", () => {
  test("the frame, a crumb back to the deal, the time left, the hold, and each item in the brand's words", async () => {
    await openPost("del_juniper_video", "YouTube video");
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
    await openPost("del_juniper_video", "YouTube video");
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
  });

  test("RW-FR-16: approving asks first, in place, and says what it means for the money", async () => {
    const user = userEvent.setup();
    await openPost("del_juniper_video", "YouTube video");
    await user.click(within(review()).getByRole("button", { name: "Approve draft" }));
    expect(within(review()).getByText(/Your \$1,500\.00 is taken only once the live post checks out\./)).toBeVisible();
    await user.click(within(review()).getByRole("button", { name: "Not yet" }));
    await user.click(within(review()).getByRole("button", { name: "Approve draft" }));
    await user.click(within(review()).getByRole("button", { name: "Yes, approve" }));
    expect(await within(review()).findByText(/^Approved by you · /)).toBeVisible();
  });

  test("RW-FR-20: a window that ended while objections were being written: approved, and the notes stay to copy", async () => {
    const user = userEvent.setup();
    await openPost("del_juniper_video", "YouTube video");
    await user.click(within(checklist()).getByRole("button", { name: /^Say the code TIDE15/ }));
    await user.click(screen.getByRole("button", { name: "Object to Say the code TIDE15" }));
    await user.type(screen.getByRole("textbox", { name: "What’s wrong with Say the code TIDE15?" }), "Say it slower.");
    await user.click(screen.getByRole("button", { name: "Save objection" }));
    await endReviewWindow("del_juniper_video");
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
    await openPost("del_juniper_reel", "Instagram Reel");
    expect(within(review()).getByText("Ada Okafor asked you to accept 1 item.")).toBeVisible();
    const asked = card("Bath salts shown dissolving in water");
    expect(within(asked).getByRole("button", { name: /^Bath salts/ })).toHaveAttribute("aria-expanded", "true");
    await user.click(within(asked).getByRole("button", { name: "Accept" }));
    expect(await within(review()).findByText(/^Every item passed\./)).toBeVisible();
  });

  test("asking Ada to fix it, with an optional note", async () => {
    const user = userEvent.setup();
    await openPost("del_juniper_reel", "Instagram Reel");
    const asked = card("Bath salts shown dissolving in water");
    await user.click(within(asked).getByRole("button", { name: "Ask Ada Okafor to fix it" }));
    await user.type(within(asked).getByRole("textbox", { name: "A note for Ada Okafor (optional)" }), "Let them fully dissolve.");
    await user.click(within(asked).getByRole("button", { name: "Send to Ada Okafor" }));
    expect(await within(card("Bath salts shown dissolving in water")).findByText("You asked for a fix")).toBeVisible();
    expect(within(review()).getByText("You answered Ada Okafor.")).toBeVisible();
  });
});

describe("RW-FR-06, RW-FR-22 nothing to see yet, and approved", () => {
  test("before an ask or the window, no draft is shown", async () => {
    Object.assign(findDeliverable("del_juniper_short")!, { state: "checking" });
    await openPost("del_juniper_short", "YouTube Short");
    expect(screen.getByText("Ada Okafor is working on the draft.")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Checklist" })).toBeNull();
  });

  test("an approved draft says who posts next and when the money is taken; no actions", async () => {
    await openPost("del_juniper_short", "YouTube Short");
    expect(within(review()).getByText(/^Approved by you · /)).toBeVisible();
    expect(within(review()).getByText(/Ada Okafor posts by .+\. Your \$350\.00 is taken only once the live post checks out\./)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Approve|Object/ })).toBeNull();
  });
});

describe("PP-FR-26 to PP-FR-30 after posting", () => {
  const posted = (liveCheck: object) =>
    Object.assign(findDeliverable("del_juniper_short")!, {
      state: "published",
      post: { url: "https://www.youtube.com/watch?v=tideshort01", publishedAt: new Date().toISOString() },
      liveCheck,
    });
  const later = () => new Date(Date.now() + 40 * 3_600_000).toISOString();

  test("couldn't decide: the live post, why, the silence line; confirming takes the money", async () => {
    const user = userEvent.setup();
    posted({ state: "undecided", what: "the paid promotion label", brandBy: later() });
    await openPost("del_juniper_short", "YouTube Short");
    expect(screen.getByRole("link", { name: "View the live post" })).toHaveAttribute("href", "https://www.youtube.com/watch?v=tideshort01");
    expect(within(review()).getByText(/If you say nothing by .+, Ada Okafor is paid\./)).toBeVisible();
    await user.click(within(review()).getByRole("button", { name: "Confirm the post" }));
    expect(within(review()).getByText(/Your \$350\.00 is taken and Ada Okafor is paid\./)).toBeVisible();
    await user.click(within(review()).getByRole("button", { name: "Yes, confirm" }));
    expect(await within(review()).findByText(/Ada Okafor’s payment is on its way\./)).toBeVisible();
  });

  test("objecting needs a reason, then a person at Cleared decides", async () => {
    const user = userEvent.setup();
    posted({ state: "undecided", what: "the paid promotion label", brandBy: later() });
    await openPost("del_juniper_short", "YouTube Short");
    await user.click(within(review()).getByRole("button", { name: "Object" }));
    await user.click(within(review()).getByRole("button", { name: "Send objection" }));
    expect(within(review()).getByText("Say why you’re objecting.")).toBeVisible();
    await user.type(within(review()).getByRole("textbox", { name: "Why are you objecting?" }), "The label isn’t on.");
    await user.click(within(review()).getByRole("button", { name: "Send objection" }));
    expect(await within(review()).findByText("A person at Cleared is deciding")).toBeVisible();
  });

  test("failed for good: accept the post anyway, after a confirmation; silence returns the money", async () => {
    const user = userEvent.setup();
    posted({ state: "not_fixable", reason: "The live post isn’t the approved draft.", brandBy: later() });
    await openPost("del_juniper_short", "YouTube Short");
    expect(within(review()).getByText(/If you don’t accept it by .+, the hold comes back to you\./)).toBeVisible();
    await user.click(within(review()).getByRole("button", { name: "Accept the post anyway" }));
    await user.click(within(review()).getByRole("button", { name: "Yes, accept" }));
    expect(await within(review()).findByText("Paid")).toBeVisible();
  });
});

describe("CN-FR-01, CN-FR-04, CN-FR-10 the brand cancels a post (design B)", () => {
  test("the hold turns over to confirm; cancelling brings the money back and says so", async () => {
    const user = userEvent.setup();
    await openPost("del_juniper_reel", "Instagram Reel");
    await user.click(screen.getAllByRole("button", { name: "Cancel this post" })[0]);
    const card = screen.getByRole("region", { name: "Cancel this post?" });
    expect(card).toHaveTextContent("Would come back to you");
    expect(card).toHaveTextContent("$600.00");
    await user.type(within(card).getByRole("textbox", { name: "Add a note for Ada Okafor (optional)" }), "Pausing the campaign.");
    await user.click(within(card).getByRole("button", { name: "Cancel the post" }));
    expect((await screen.findAllByText(/Your \$600\.00 came back to you on \d+ \w+\. You cancelled this post\./)).length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "The hold" })).toHaveTextContent("Released · $600.00");
    expect(screen.queryByRole("button", { name: "Cancel this post" })).toBeNull();
  });

  test("CN-FR-03: with the creator's go-ahead running, the line says why", async () => {
    await api.getGoAhead("del_juniper_short");
    await openPost("del_juniper_short", "YouTube Short");
    expect((await screen.findAllByText("You can’t cancel now: Ada Okafor has the go-ahead to post.")).length).toBeGreaterThan(0);
  });
});
