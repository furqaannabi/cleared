import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";
import { apiBaseUrl } from "@/lib/api";
import { server } from "@/mocks/node";
import { aProfile, anInvite, apiError, stubInvite, stubSession } from "@/test/stub-api";
import { InvitePage } from "./invite-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

/* IN 1.3: the invite page against the contract's answers, one stub per test. */

describe("IN-FR-06 (1.3) the API refuses an amount", () => {
  test("its code shows the same words as the typed limit, and is not shown as saved", async () => {
    const invite = anInvite();
    stubSession(aProfile());
    stubInvite(invite);
    server.use(
      http.patch(`${apiBaseUrl}/deals/${invite.dealId}/invite/posts/del_pine_video`, () => apiError({ code: "amount_above_maximum", field: "amount" }, 400)),
    );
    render(<InvitePage dealId={invite.dealId} />);
    const amount = await screen.findByRole("textbox", { name: "Amount for the YouTube video" });
    await userEvent.type(amount, "900");
    await userEvent.tab();
    expect(await screen.findByText("The most one post can be is $10,000.00.")).toBeVisible();
    expect(amount).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});

describe("IN-FR-13 (1.3) the brand's email", () => {
  test("says it is only for after the post is live, and that the creator sends the link", async () => {
    const invite = anInvite();
    stubSession(aProfile());
    stubInvite(invite);
    render(<InvitePage dealId={invite.dealId} />);
    const email = await screen.findByRole("textbox", { name: "Pine & Co’s email (optional)" });
    expect(email).toHaveAccessibleDescription("Only used if Pine & Co needs to act after your post is live. You send the link yourself.");
  });
});

describe("IN-FR-11 (1.3) connecting through the backend", () => {
  const withReel = () =>
    anInvite({ posts: [{ deliverableId: "del_pine_video", platform: "youtube_video", itemCount: 3 }, { deliverableId: "del_pine_reel", platform: "instagram_reel", itemCount: 2 }] });

  test("Connect Instagram is a link to the backend that comes back to this page", async () => {
    const invite = withReel();
    stubSession(aProfile());
    stubInvite(invite);
    render(<InvitePage dealId={invite.dealId} />);
    expect(await screen.findByRole("link", { name: "Connect Instagram" })).toHaveAttribute(
      "href",
      `${apiBaseUrl}/connect/instagram?next=%2Fdeals%2Fdeal_pine%2Finvite%3Fconnecting%3Dinstagram`,
    );
  });

  test("back from Instagram with a personal account: the card says how to switch, and the address is cleaned", async () => {
    window.history.replaceState(null, "", "/deals/deal_pine/invite?connecting=instagram&connect=not_professional");
    const invite = withReel();
    stubSession(aProfile());
    stubInvite(invite);
    render(<InvitePage dealId={invite.dealId} />);
    expect(
      await screen.findByText("That Instagram account isn’t a professional account. Switch it to Creator or Business in Instagram, then connect again."),
    ).toBeVisible();
    expect(window.location.search).toBe("");
  });
});

describe("IN-FR-12 (1.3) a new PayPal email", () => {
  test("lists the payouts already with PayPal, which keep the old email", async () => {
    const invite = anInvite();
    stubSession(aProfile({ paypalEmail: "ada@old.com" }));
    stubInvite(invite);
    server.use(
      http.put(`${apiBaseUrl}/me/paypal-email`, () =>
        HttpResponse.json({
          ...aProfile({ paypalEmail: "ada@new.com" }),
          postsKeepingEmail: [{ deliverableId: "del_glow_video", dealId: "deal_glow", brandName: "Glow Theory", email: "ada@old.com" }],
        }),
      ),
    );
    render(<InvitePage dealId={invite.dealId} />);
    const email = await screen.findByRole("textbox", { name: "Your PayPal email" });
    await userEvent.clear(email);
    await userEvent.type(email, "ada@new.com");
    await userEvent.tab();
    const note = await screen.findByRole("status", { name: "Payouts keeping the old email" });
    expect(note).toHaveTextContent("Saved. A payout already with PayPal still goes to ada@old.com:");
    expect(note).toHaveTextContent("Glow Theory");
  });
});

describe("IN-FR-17 (1.3) creating the link", () => {
  test("sends the creator's timezone; a local link on http://localhost is accepted (IN-BR-04)", async () => {
    const invite = anInvite({ posts: [{ deliverableId: "del_pine_video", platform: "youtube_video", itemCount: 3, amount: "1200.00", deadlineDays: 14 }] });
    stubSession(aProfile({ paypalEmail: "ada@example.com" }));
    stubInvite(invite);
    let sent: unknown;
    server.use(
      http.post(`${apiBaseUrl}/deals/${invite.dealId}/invite/link`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({
          ...invite,
          step: "waiting_for_brand",
          link: { url: "http://localhost:3000/b/tok_local", expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(), expired: false },
        });
      }),
    );
    render(<InvitePage dealId={invite.dealId} />);
    await userEvent.click(await screen.findByRole("button", { name: "Create link for Pine & Co" }));
    expect(await screen.findByText("http://localhost:3000/b/tok_local")).toBeVisible();
    expect(sent).toEqual({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  });
});

describe("IN-FR-23 (1.4) a refused link says why and re-reads the page", () => {
  const filled = (i: Partial<Parameters<typeof anInvite>[0]> = {}) =>
    anInvite({
      posts: [
        { deliverableId: "del_pine_video", platform: "youtube_video", itemCount: 3, amount: "1200.00", deadlineDays: 14 },
        { deliverableId: "del_pine_reel", platform: "instagram_reel", itemCount: 2, amount: "450.00", deadlineDays: 10 },
      ],
      ...i,
    });
  const both = [
    { platform: "youtube" as const, name: "Ada Okafor" },
    { platform: "instagram" as const, name: "ada.makes" },
  ];

  test("Instagram not connected: the words, no Try again, and Connect Instagram back from a second read", async () => {
    const invite = filled();
    stubInvite(invite);
    let reads = 0;
    server.use(
      http.get(`${apiBaseUrl}/me`, () => {
        reads += 1;
        // The page first believes Instagram is connected; the API knows it isn't.
        return HttpResponse.json(aProfile({ paypalEmail: "ada@example.com", accounts: reads === 1 ? both : both.slice(0, 1) }));
      }),
      http.post(`${apiBaseUrl}/deals/${invite.dealId}/invite/link`, () => apiError({ code: "instagram_not_connected" }, 409)),
    );
    render(<InvitePage dealId={invite.dealId} />);
    await userEvent.click(await screen.findByRole("button", { name: "Create link for Pine & Co" }));
    expect(await screen.findByText("Connect Instagram before you create the link.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(await screen.findByRole("link", { name: "Connect Instagram" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Create link for Pine & Co" })).toHaveAttribute("aria-disabled", "true");
  });

  test("Send updated terms refused for a missing PayPal email ends with sending the updated terms", async () => {
    const invite = filled({ step: "changes_requested" });
    stubSession(aProfile({ paypalEmail: "ada@example.com", accounts: both }));
    stubInvite(invite);
    server.use(http.post(`${apiBaseUrl}/deals/${invite.dealId}/invite/send`, () => apiError({ code: "paypal_email_missing" }, 409)));
    render(<InvitePage dealId={invite.dealId} />);
    await userEvent.click(await screen.findByRole("button", { name: "Send updated terms to Pine & Co" }));
    expect(await screen.findByText("Add your PayPal email before you send the updated terms.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  test("any other refusal keeps “We couldn’t save that.” with Try again", async () => {
    const invite = filled();
    stubSession(aProfile({ paypalEmail: "ada@example.com", accounts: both }));
    stubInvite(invite);
    server.use(http.post(`${apiBaseUrl}/deals/${invite.dealId}/invite/link`, () => apiError({ code: "not_allowed" }, 409)));
    render(<InvitePage dealId={invite.dealId} />);
    await userEvent.click(await screen.findByRole("button", { name: "Create link for Pine & Co" }));
    expect(await screen.findByText(/We couldn’t save that\./)).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});
