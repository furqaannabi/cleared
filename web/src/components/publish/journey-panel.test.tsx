import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";
import { DraftCheckPage } from "@/components/draft-check/draft-check-page";
import type { Deliverable } from "@/lib/deliverable/types";
import { seededPosts, stubPosts } from "@/test/creator-posts";
import { juniperDeliverables } from "@/test/fixtures/juniper";
import { aProfile, recordRequests, stubSession } from "@/test/stub-api";

const journey = () => screen.getByRole("region", { name: "From approved to paid" });
const open = async (deliverableId: string, dealId = "deal_juniper") => {
  render(<DraftCheckPage dealId={dealId} deliverableId={deliverableId} />);
  return screen.findByRole("region", { name: "From approved to paid" });
};
const juniper = (id: string) => juniperDeliverables(Date.now()).find((d) => d.id === id)!;
const wren = () => seededPosts().find((d) => d.id === "del_wren_video")!;
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const goAhead = (d: Deliverable): Deliverable => ({ ...d, state: "posting", goAhead: { state: "go", endsAt: inHours(48) } });
const posted = (d: Deliverable, url: string): Deliverable => ({ ...d, state: "published", post: { url, publishedAt: new Date().toISOString() }, liveCheck: { state: "checking" } });

beforeEach(() => stubSession(aProfile({ paypalEmail: "ada@example.com" })));

describe("PP-FR-01, PP-FR-02 the go-ahead, in the journey", () => {
  test("past Approved the journey replaces the money card; Get the go-ahead gives a countdown and I've posted it", async () => {
    const user = userEvent.setup();
    stubPosts(juniper("del_juniper_short")).on("del_juniper_short", "post", "/go-ahead", goAhead);
    const panel = await open("del_juniper_short");
    expect(panel).toHaveTextContent("Held in PayPal for this Short");
    expect(within(panel).getByText(/^Ref DEMO-\w+ · held \d+ \w+$/)).toBeVisible();
    expect(within(panel).getByText("$350.00")).toBeVisible();
    expect(screen.queryByRole("region", { name: /Held in PayPal/ })).toBeNull();
    await user.click(within(panel).getAllByRole("button", { name: "Get the go-ahead" })[0]);
    expect(await within(journey()).findByText("You can post now")).toBeVisible();
    expect(within(journey()).getByText(/^\d+h \d+m$/)).toBeVisible();
    expect(within(journey()).getAllByRole("button", { name: "I’ve posted it" })[0]).toBeVisible();
  });
});

describe("PP-FR-06, PP-FR-07 posting", () => {
  test("YouTube: confirm it's public, then the live check starts", async () => {
    const user = userEvent.setup();
    const short = goAhead(juniper("del_juniper_short"));
    stubPosts(short).on("del_juniper_short", "post", "/posted", (d) => posted(d, "https://www.youtube.com/shorts/tideshort01"));
    const panel = await open("del_juniper_short");
    await user.click(within(panel).getAllByRole("button", { name: "I’ve posted it" })[0]);
    expect(within(journey()).getByText(/Is the video public on your channel\?/)).toBeVisible();
    await user.click(within(journey()).getByRole("button", { name: "Yes, it’s public" }));
    expect(await within(journey()).findByText("Checking your live post…")).toBeVisible();
  });

  test("a Reel: its link, checked for shape before sending", async () => {
    const user = userEvent.setup();
    const base = juniper("del_juniper_reel");
    const reel = goAhead({
      ...base,
      state: "approved",
      approvedAt: new Date().toISOString(),
      approvedBy: "brand",
      items: base.items.map((i) => (i.status === "waiting_for_brand" ? { ...i, status: "accepted_by_brand" } : i)),
    });
    stubPosts(reel).on("del_juniper_reel", "post", "/posted", (d, { body }) => posted(d, (body as { url: string }).url));
    const panel = await open("del_juniper_reel");
    const sent = recordRequests();
    await user.click(within(panel).getAllByRole("button", { name: "I’ve posted it" })[0]);
    const link = within(journey()).getByRole("textbox", { name: "Your Reel’s link" });
    await user.type(link, "https://example.com/nope");
    await user.click(within(journey()).getByRole("button", { name: "Check my Reel" }));
    expect(within(journey()).getByText("That doesn’t look like a link to an Instagram Reel.")).toBeVisible();
    expect(sent.filter((r) => r.method === "POST")).toEqual([]);
    await user.clear(link);
    await user.type(link, "https://www.instagram.com/reel/C9xT2abc/");
    await user.click(within(journey()).getByRole("button", { name: "Check my Reel" }));
    expect(await within(journey()).findByText("Checking your live post…")).toBeVisible();
    expect(sent).toContainEqual({ method: "POST", path: "/deliverables/del_juniper_reel/posted", body: { url: "https://www.instagram.com/reel/C9xT2abc/" } });
  });
});

describe("PP-FR-18 to PP-FR-20 money", () => {
  test("paid: Cleared, what was paid, every reference, nothing to do", async () => {
    stubPosts(wren());
    const panel = await open("del_wren_video", "deal_wren");
    expect(panel).toHaveTextContent("Cleared");
    expect(within(panel).getByText("$760.00")).toBeVisible();
    expect(panel).toHaveTextContent("Payout ref DEMO-PAY7Q15");
    expect(within(panel).getByText("Paid to ada@example.com · 4 Oct")).toBeVisible();
    expect(panel).toHaveTextContent("PayPal ref DEMO-CAP4W92");
    expect(within(panel).queryByRole("button")).toBeNull();
  });

  test("a bounced payout: correct the PayPal email in place, then send it again", async () => {
    const user = userEvent.setup();
    const bounced: Deliverable = { ...wren(), state: "captured", payout: { state: "failed", email: "ada@exmaple.com", reason: "returned", canSendAgain: true } };
    stubPosts(bounced).on("del_wren_video", "post", "/payout/again", (d) => ({ ...d, payout: { state: "sending", email: "ada@example.com", canSendAgain: false } }));
    const sent = recordRequests();
    const panel = await open("del_wren_video", "deal_wren");
    expect(panel).toHaveTextContent("$760.00 couldn’t be paid to ada@exmaple.com");
    const email = within(panel).getByRole("textbox", { name: "Your PayPal email" });
    await user.clear(email);
    await user.type(email, "ada@example.com");
    await user.click(within(panel).getAllByRole("button", { name: "Save and send it again" })[0]);
    expect(await within(journey()).findByText("Sending $760.00 to ada@example.com")).toBeVisible();
    expect(sent.filter((r) => r.method !== "GET").map((r) => r.path)).toEqual(["/me/paypal-email", "/deliverables/del_wren_video/payout/again"]);
  });
});

describe("PP-FR-35, PP-FR-36 a payout on Sponing's side", () => {
  test("delayed: on Sponing's side, nothing for the creator to do", async () => {
    stubPosts({ ...wren(), state: "captured", payout: { state: "delayed", email: "ada@example.com", at: new Date().toISOString(), canSendAgain: false } });
    const panel = await open("del_wren_video", "deal_wren");
    expect(panel).toHaveTextContent("Sending $760.00 to ada@example.com is delayed");
    expect(panel).toHaveTextContent("There’s nothing you need to do.");
    expect(within(panel).queryByRole("button")).toBeNull();
  });

  test("Send it again on an unclaimed payout: sending again while PayPal cancels it, then sending", async () => {
    const user = userEvent.setup();
    const unclaimed: Deliverable = { ...wren(), state: "captured", payout: { state: "unclaimed", email: "ada@example.com", canSendAgain: true } };
    const posts = stubPosts(unclaimed);
    posts.on("del_wren_video", "post", "/payout/again", (d) => ({ ...d, payout: { state: "cancelling", email: "ada@example.com", canSendAgain: false } }));
    const panel = await open("del_wren_video", "deal_wren");
    await user.click(within(panel).getAllByRole("button", { name: "Send it again" })[0]);
    expect(await within(journey()).findByText("Sending $760.00 again")).toBeVisible();
    // PayPal has cancelled the unclaimed payout: the page's next read finds it sending.
    stubPosts({ ...unclaimed, payout: { state: "sending", email: "ada@example.com", canSendAgain: false } });
    expect(await within(journey()).findByText("Sending $760.00 to ada@example.com", undefined, { timeout: 8000 })).toBeVisible();
  }, 10_000);
});
