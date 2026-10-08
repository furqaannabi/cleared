import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { api } from "@/lib/api";
import { DraftCheckPage } from "@/components/draft-check/draft-check-page";
import { findDeliverable } from "@/mocks/store";

const journey = () => screen.getByRole("region", { name: "From approved to paid" });
const open = async (deliverableId: string, dealId = "deal_juniper") => {
  render(<DraftCheckPage dealId={dealId} deliverableId={deliverableId} />);
  return screen.findByRole("region", { name: "From approved to paid" });
};

describe("PP-FR-01, PP-FR-02 the go-ahead, in the journey", () => {
  test("past Approved the journey replaces the money card; Get the go-ahead gives a countdown and I've posted it", async () => {
    const user = userEvent.setup();
    const panel = await open("del_juniper_short");
    expect(panel).toHaveTextContent("Held for this Short");
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
    await api.getGoAhead("del_juniper_short");
    const panel = await open("del_juniper_short");
    await user.click(within(panel).getAllByRole("button", { name: "I’ve posted it" })[0]);
    expect(within(journey()).getByText(/Is the video public on your channel\?/)).toBeVisible();
    await user.click(within(journey()).getByRole("button", { name: "Yes, it’s public" }));
    expect(await within(journey()).findByText("Checking your live post…")).toBeVisible();
  });

  test("a Reel: its link, checked for shape before sending", async () => {
    const user = userEvent.setup();
    await api.openBrandLink("demo_juniper");
    await api.acceptItem("deal_juniper", "del_juniper_reel", "jr_1");
    await api.approveDraft("deal_juniper", "del_juniper_reel");
    await api.getGoAhead("del_juniper_reel");
    const panel = await open("del_juniper_reel");
    await user.click(within(panel).getAllByRole("button", { name: "I’ve posted it" })[0]);
    const link = within(journey()).getByRole("textbox", { name: "Your Reel’s link" });
    await user.type(link, "https://example.com/nope");
    await user.click(within(journey()).getByRole("button", { name: "Check my Reel" }));
    expect(within(journey()).getByText("That doesn’t look like a link to an Instagram Reel.")).toBeVisible();
    await user.clear(link);
    await user.type(link, "https://www.instagram.com/reel/C9xT2abc/");
    await user.click(within(journey()).getByRole("button", { name: "Check my Reel" }));
    expect(await within(journey()).findByText("Checking your live post…")).toBeVisible();
  });
});

describe("PP-FR-18 to PP-FR-20 money", () => {
  test("paid: Cleared, what was paid, every reference, nothing to do", async () => {
    const panel = await open("del_wren_video", "deal_wren");
    expect(panel).toHaveTextContent("Cleared");
    expect(within(panel).getByText("$760.00")).toBeVisible();
    expect(panel).toHaveTextContent("Payout ref DEMO-PAY7Q15");
    expect(panel).toHaveTextContent("PayPal ref DEMO-CAP4W92");
    expect(within(panel).queryByRole("button")).toBeNull();
  });

  test("a bounced payout: correct the PayPal email in place, then send it again", async () => {
    const user = userEvent.setup();
    Object.assign(findDeliverable("del_wren_video")!, {
      state: "captured",
      payout: { state: "failed", email: "ada@exmaple.com", reason: "PayPal says there’s no account at that email.", canSendAgain: true },
    });
    const panel = await open("del_wren_video", "deal_wren");
    expect(panel).toHaveTextContent("$760.00 couldn’t be paid to ada@exmaple.com");
    const email = within(panel).getByRole("textbox", { name: "Your PayPal email" });
    await user.clear(email);
    await user.type(email, "ada@example.com");
    await user.click(within(panel).getAllByRole("button", { name: "Save and send it again" })[0]);
    expect(await within(journey()).findByText("Sending $760.00 to ada@example.com")).toBeVisible();
  });
});

describe("PP-FR-35, PP-FR-36 a payout on Cleared's side", () => {
  test("delayed: on Cleared's side, nothing for the creator to do", async () => {
    Object.assign(findDeliverable("del_wren_video")!, {
      state: "captured",
      payout: { state: "delayed", email: "ada@example.com", at: new Date().toISOString(), canSendAgain: false },
    });
    const panel = await open("del_wren_video", "deal_wren");
    expect(panel).toHaveTextContent("Sending $760.00 to ada@example.com is delayed");
    expect(panel).toHaveTextContent("There’s nothing you need to do.");
    expect(within(panel).queryByRole("button")).toBeNull();
  });

  test("Send it again on an unclaimed payout: sending again while PayPal cancels it, then sending", async () => {
    const user = userEvent.setup();
    Object.assign(findDeliverable("del_wren_video")!, {
      state: "captured",
      payout: { state: "unclaimed", email: "ada@example.com", canSendAgain: true },
    });
    const panel = await open("del_wren_video", "deal_wren");
    await user.click(within(panel).getAllByRole("button", { name: "Send it again" })[0]);
    expect(await within(journey()).findByText("Sending $760.00 again")).toBeVisible();
    expect(await within(journey()).findByText("Sending $760.00 to ada@example.com", undefined, { timeout: 8000 })).toBeVisible();
  }, 10_000);
});
