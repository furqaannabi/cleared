import { describe, expect, it } from "vitest";
import { inviteView } from "./invite-view";
import type { CreatorProfile, DealInvite } from "./types";

const today = new Date(2026, 9, 8); // 8 Oct 2026

function invite(over: Partial<DealInvite> = {}): DealInvite {
  return {
    dealId: "deal_1",
    brandName: "Glow Theory",
    step: "invite",
    posts: [
      { deliverableId: "del_v", platform: "youtube_video", itemCount: 6, amount: "1200.00", deadlineDays: 14 },
      { deliverableId: "del_r", platform: "instagram_reel", itemCount: 6, amount: "450.00", deadlineDays: 10 },
    ],
    ...over,
  };
}

const profile: CreatorProfile = {
  name: "Ada Okafor",
  paypalEmail: "ada@example.com",
  accounts: [{ platform: "youtube", name: "Ada Okafor" }],
};

describe("inviteView: what's left before Create link (IN-FR-16, IN-BR-07)", () => {
  it("names the first thing left and how many more, in page order", () => {
    const view = inviteView(
      invite({ posts: [{ deliverableId: "del_r", platform: "instagram_reel", itemCount: 6 }] }),
      { ...profile, paypalEmail: undefined },
      today,
    );
    expect(view.canCreate).toBe(false);
    expect(view.left).toEqual({ first: "Add an amount for the Instagram Reel", more: 3 });
  });

  it("asks to connect an account a post needs before anything about email", () => {
    const view = inviteView(invite(), profile, today);
    expect(view.left).toEqual({ first: "Connect Instagram", more: 0 });
    expect(view.canCreate).toBe(false);
  });

  it("allows Create link once every post is set, every needed account connected, and the PayPal email given", () => {
    const view = inviteView(invite(), { ...profile, accounts: [...profile.accounts, { platform: "instagram", name: "ada.makes" }] }, today);
    expect(view.left).toBeNull();
    expect(view.canCreate).toBe(true);
  });
});

describe("inviteView: posts and the total (IN-FR-04, IN-FR-07, IN-FR-08)", () => {
  it("gives each post its label and an example due date counted from today", () => {
    const view = inviteView(invite(), profile, today);
    expect(view.posts.map((p) => [p.label, p.exampleDate])).toEqual([
      ["YouTube video", "22 Oct"],
      ["Instagram Reel", "18 Oct"],
    ]);
  });

  it("totals the amounts only when every post has one", () => {
    expect(inviteView(invite(), profile, today).total).toBe("1650.00");
    const missing = invite({ posts: [invite().posts[0], { deliverableId: "del_r", platform: "instagram_reel", itemCount: 6 }] });
    expect(inviteView(missing, profile, today).total).toBeNull();
    expect(inviteView(missing, profile, today).posts[1].exampleDate).toBeNull();
  });
});

describe("inviteView: Before you send (IN-FR-10, IN-FR-16)", () => {
  it("ticks off amounts and deadlines, each needed account, and the PayPal email", () => {
    const view = inviteView(invite(), profile, today);
    expect(view.checks).toEqual([
      { key: "posts", label: "Amounts and deadlines", done: true },
      { key: "youtube", label: "YouTube connected as Ada Okafor", done: true },
      { key: "instagram", label: "Connect Instagram", done: false },
      { key: "paypal", label: "PayPal email", done: true },
    ]);
  });
});
