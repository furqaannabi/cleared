import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";
import { api, apiBaseUrl } from "@/lib/api";
import { server } from "@/mocks/node";
import { setReadingSpeed } from "@/mocks/deal-drafts";
import { InvitePage } from "./invite-page";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const BRIEF = ["In the YouTube video, say “Glow Theory” in the first 60 seconds.", "Say and show the code GLOW20.", "Mark the post as a paid promotion."].join("\n");

/** A deal whose checklist is ready, rendered on the invite page. */
async function openInvite() {
  setReadingSpeed(0);
  const created = await api.createDeal({ brandName: "Glow Theory", deliverables: [{ platform: "youtube_video" }, { platform: "instagram_reel" }] });
  if (!created.ok) throw new Error(created.error);
  await api.submitBrief(created.data.id, BRIEF);
  await api.getDealDraft(created.data.id);
  await api.markChecklistReady(created.data.id);
  render(<InvitePage dealId={created.data.id} />);
  await screen.findByRole("heading", { level: 1, name: "Glow Theory · Invite" });
  return created.data;
}
const sheet = () => screen.getByRole("region", { name: "Sponsorship terms" });

describe("IN-FR-04, IN-FR-16 the invite page", () => {
  test("shows the terms sheet with a line per post, and holds Create link back with what's left", async () => {
    await openInvite();
    const lines = within(sheet()).getAllByRole("group");
    expect(lines.map((l) => l.getAttribute("aria-label"))).toEqual(["YouTube video", "Instagram Reel"]);
    expect(within(sheet()).getByText("Ada Okafor")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create link for Glow Theory" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Add an amount for the YouTube video")).toBeVisible();
    expect(screen.getByText("and 4 more")).toBeVisible();
  });
});

describe("IN-FR-05, IN-FR-15 amounts", () => {
  test("an amount saves when the field is left, and shows as dollars", async () => {
    const deal = await openInvite();
    const field = screen.getByRole("textbox", { name: "Amount for the YouTube video" });
    await userEvent.type(field, "1200");
    await userEvent.tab();
    await waitFor(async () => {
      const r = await api.getInvite(deal.id);
      expect(r.ok && r.data.posts[0].amount).toBe("1200.00");
    });
    expect(field).toHaveValue("1,200.00");
  });

  test("an amount that isn't dollars is explained beside the field and not saved", async () => {
    const deal = await openInvite();
    const field = screen.getByRole("textbox", { name: "Amount for the YouTube video" });
    await userEvent.type(field, "12.345");
    await userEvent.tab();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Enter an amount in dollars, like 1200 or 1200.50");
    const r = await api.getInvite(deal.id);
    expect(r.ok && r.data.posts[0].amount).toBeUndefined();
  });

  test("a failed save says so beside the field, with Try again", async () => {
    await openInvite();
    server.use(http.patch(`${apiBaseUrl}/deals/:dealId/invite/posts/:id`, () => HttpResponse.json({}, { status: 500 })));
    await userEvent.type(screen.getByRole("textbox", { name: "Amount for the Instagram Reel" }), "450");
    await userEvent.tab();
    const line = within(sheet()).getByRole("group", { name: "Instagram Reel" });
    expect(await within(line).findByText("We couldn’t save that.")).toBeVisible();
    server.resetHandlers();
    await userEvent.click(within(line).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(within(line).queryByText("We couldn’t save that.")).toBeNull());
  });
});

describe("IN-FR-07 deadlines in days after the hold", () => {
  const inDays = (n: number) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(Date.now() + n * 86_400_000));

  test("typing a deadline saves it and shows the example date; + and − step it and stop at 1 and 21", async () => {
    const deal = await openInvite();
    const line = within(sheet()).getByRole("group", { name: "YouTube video" });
    const days = within(line).getByRole("spinbutton", { name: "Days after the hold for the YouTube video" });
    await userEvent.type(days, "20");
    await userEvent.tab();
    expect(await within(line).findByText(`${inDays(20)} if approved today`)).toBeVisible();
    await userEvent.click(within(line).getByRole("button", { name: "One day more for the YouTube video" }));
    expect(days).toHaveValue(21);
    expect(within(line).getByRole("button", { name: "One day more for the YouTube video" })).toBeDisabled();
    await waitFor(async () => {
      const r = await api.getInvite(deal.id);
      expect(r.ok && r.data.posts[0].deadlineDays).toBe(21);
    });
    await userEvent.click(within(line).getByRole("button", { name: "One day fewer for the YouTube video" }));
    expect(days).toHaveValue(20);
  });

  test("more than 21 days is explained and not saved", async () => {
    const deal = await openInvite();
    const days = screen.getByRole("spinbutton", { name: "Days after the hold for the Instagram Reel" });
    await userEvent.type(days, "30");
    await userEvent.tab();
    expect(days).toHaveAccessibleDescription("Up to 21 days. PayPal only holds money for 29 days, so Cleared keeps a margin.");
    const r = await api.getInvite(deal.id);
    expect(r.ok && r.data.posts[1].deadlineDays).toBeUndefined();
  });
});

describe("IN-FR-08, IN-FR-12, IN-FR-14 the rest of the sheet", () => {
  test("the total appears once every post has an amount", async () => {
    const deal = await openInvite();
    expect(within(sheet()).queryByText("$1,650.00")).toBeNull();
    await api.updateInvitePost(deal.id, deal.deliverables[0].id, { amount: "1200.00" });
    await userEvent.type(screen.getByRole("textbox", { name: "Amount for the Instagram Reel" }), "450");
    await userEvent.tab();
    expect(await within(sheet()).findByText("$1,650.00")).toBeVisible();
    expect(within(sheet()).getByText("Total, held as one hold per post")).toBeVisible();
  });

  test("the PayPal email is filled from the profile, warns that payments can't be pulled back, and saves a change", async () => {
    await openInvite();
    const email = within(sheet()).getByRole("textbox", { name: "Your PayPal email" });
    expect(email).toHaveValue("ada@example.com");
    expect(email).toHaveAccessibleDescription(/a payment to the wrong email can’t be pulled back/);
    await userEvent.clear(email);
    await userEvent.type(email, "not-an-email");
    await userEvent.tab();
    expect(email).toHaveAccessibleDescription(/Enter an email, like name@example.com/);
    await userEvent.clear(email);
    await userEvent.type(email, "ada.okafor@example.com");
    await userEvent.tab();
    await waitFor(async () => {
      const r = await api.getProfile();
      expect(r.ok && r.data.paypalEmail).toBe("ada.okafor@example.com");
    });
  });

  test("shows the four fixed rules of how the creator is paid", async () => {
    await openInvite();
    const rules = within(sheet()).getByRole("list", { name: "How you’ll be paid" });
    expect(within(rules).getAllByRole("listitem").map((l) => l.textContent)).toEqual([
      "Glow Theory approves a hold for each post. The money is reserved, not taken.",
      "Your draft is checked against the checklist. If every item passes, Glow Theory has 48 hours to object. If they don’t, it’s approved. Anything that doesn’t pass waits for you to fix it or for Glow Theory to accept it.",
      "Post by the deadline. Once the live post checks out, you’re paid to your PayPal.",
      "Miss the deadline, and the hold goes back to Glow Theory.",
    ]);
  });
});

const beforeYouSend = () => screen.getByRole("region", { name: "Before you send" });

describe("IN-FR-09 to IN-FR-11, IN-FR-13 Before you send", () => {
  test("lists what's done and connects Instagram, the account the Reel needs", async () => {
    await openInvite();
    const list = within(beforeYouSend()).getByRole("list");
    expect(within(list).getByText("YouTube connected as Ada Okafor")).toBeVisible();
    expect(within(list).getByText(/Professional accounts only/)).toBeVisible();
    await userEvent.click(within(list).getByRole("button", { name: "Connect Instagram" }));
    expect(await within(list).findByText("Instagram connected as ada.makes")).toBeVisible();
    expect(within(list).queryByRole("button", { name: "Connect Instagram" })).toBeNull();
  });

  test("the brand's email is optional and saves when given", async () => {
    const deal = await openInvite();
    const email = within(beforeYouSend()).getByRole("textbox", { name: "Glow Theory’s email (optional)" });
    await userEvent.type(email, "sam@glowtheory.com");
    await userEvent.tab();
    await waitFor(async () => {
      const r = await api.getInvite(deal.id);
      expect(r.ok && r.data.brandEmail).toBe("sam@glowtheory.com");
    });
  });
});

/** Fills every term through the API, then opens the page. */
async function openFilledInvite(brandEmail?: string) {
  setReadingSpeed(0);
  const created = await api.createDeal({ brandName: "Glow Theory", deliverables: [{ platform: "youtube_video" }, { platform: "instagram_reel" }] });
  if (!created.ok) throw new Error(created.error);
  const id = created.data.id;
  await api.submitBrief(id, BRIEF);
  await api.getDealDraft(id);
  await api.markChecklistReady(id);
  await api.updateInvitePost(id, created.data.deliverables[0].id, { amount: "1200.00", deadlineDays: 14 });
  await api.updateInvitePost(id, created.data.deliverables[1].id, { amount: "450.00", deadlineDays: 10 });
  await api.connectAccount("instagram");
  if (brandEmail) await api.updateInvite(id, { brandEmail });
  render(<InvitePage dealId={id} />);
  await screen.findByRole("heading", { level: 1, name: "Glow Theory · Invite" });
  return created.data;
}

describe("IN-FR-16, IN-FR-17 creating the link", () => {
  test("Create link locks the terms and shows the link, who can open it, when it expires and who it was emailed to", async () => {
    const user = userEvent.setup();
    await openFilledInvite("sam@glowtheory.com");
    await user.click(screen.getByRole("button", { name: "Create link for Glow Theory" }));
    const panel = await screen.findByRole("region", { name: "Send this link to Glow Theory" });
    const url = within(panel).getByText(/^https:\/\/cleared\.example\/b\//);
    expect(within(panel).getByText("Anyone with this link can open this deal. Send it only to Glow Theory.")).toBeVisible();
    expect(within(panel).getByText(/^Expires on \d{1,2} \w{3}\.$/)).toBeVisible();
    expect(within(panel).getByText("We’ve also emailed it to sam@glowtheory.com.")).toBeVisible();
    expect(within(sheet()).queryByRole("textbox")).toBeNull();
    expect(within(sheet()).getByText("Within 14 days of the hold")).toBeVisible();
    expect(within(sheet()).getByText("$1,200.00")).toBeVisible();
    expect(screen.getByText(/waiting for them to confirm the checklist and approve the holds/)).toBeVisible();

    await user.click(within(panel).getByRole("button", { name: "Copy link" }));
    expect(await navigator.clipboard.readText()).toBe(url.textContent);
    expect(within(panel).getByText("Copied")).toHaveAttribute("role", "status");
  });

  test("Create link does nothing while something is left", async () => {
    const deal = await openInvite();
    await userEvent.click(screen.getByRole("button", { name: "Create link for Glow Theory" }));
    const r = await api.getInvite(deal.id);
    expect(r.ok && r.data.step).toBe("invite");
  });
});

describe("IN-FR-18, IN-FR-19 a new link, and changing the terms", () => {
  async function withLink() {
    const deal = await openFilledInvite();
    await userEvent.click(screen.getByRole("button", { name: "Create link for Glow Theory" }));
    return { deal, panel: await screen.findByRole("region", { name: "Send this link to Glow Theory" }) };
  }

  test("Make a new link asks first, then replaces the link", async () => {
    const { panel } = await withLink();
    const before = within(panel).getByText(/^https:/).textContent;
    await userEvent.click(within(panel).getByRole("button", { name: "Make a new link" }));
    expect(within(panel).getByText("The old link will stop working.")).toBeVisible();
    await userEvent.click(within(panel).getByRole("button", { name: "Keep this link" }));
    expect(within(panel).getByText(/^https:/).textContent).toBe(before);
    await userEvent.click(within(panel).getByRole("button", { name: "Make a new link" }));
    await userEvent.click(within(panel).getByRole("button", { name: "Yes, make a new link" }));
    await waitFor(() => expect(within(panel).getByText(/^https:/).textContent).not.toBe(before));
  });

  test("Change terms asks first, then turns the link off and makes the terms editable again", async () => {
    const { deal } = await withLink();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Change terms" }));
    expect(within(sheet()).getByText("Glow Theory’s link will stop working. You’ll make a new one when you’re done.")).toBeVisible();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Yes, change terms" }));
    expect(await screen.findByRole("textbox", { name: "Amount for the YouTube video" })).toHaveValue("1,200.00");
    expect(screen.queryByRole("region", { name: "Send this link to Glow Theory" })).toBeNull();
    const r = await api.getInvite(deal.id);
    expect(r.ok && r.data.step).toBe("invite");
    expect(r.ok && r.data.link).toBeUndefined();
  });
});

describe("IN-FR-20 an expired link", () => {
  test("says the link has expired and offers a new one", async () => {
    const deal = await openFilledInvite();
    await api.createInviteLink(deal.id);
    const live = await api.getInvite(deal.id);
    server.use(
      http.get(`${apiBaseUrl}/deals/:dealId/invite`, () =>
        HttpResponse.json({ ...(live.ok && live.data), link: { ...(live.ok && live.data.link), expired: true } }),
      ),
    );
    cleanup();
    render(<InvitePage dealId={deal.id} />);
    const panel = await screen.findByRole("region", { name: "Send this link to Glow Theory" });
    expect(within(panel).getByText("This link has expired.")).toBeVisible();
    expect(within(panel).queryByRole("button", { name: "Copy link" })).toBeNull();
    expect(within(panel).getByRole("button", { name: "Make a new link" })).toBeVisible();
  });
});

describe("IN-FR-16 the summary above Create link", () => {
  test("once everything is in place, repeats the total and where the money goes", async () => {
    await openFilledInvite();
    const bar = screen.getByRole("region", { name: "Create link" });
    expect(within(bar).getByText("$1,650.00 in total, paid to ada@example.com.")).toBeVisible();
    expect(within(bar).getByRole("button", { name: "Create link for Glow Theory" })).not.toHaveAttribute("aria-disabled");
  });
});

describe("IN-FR-03 the checklist from the invite page", () => {
  test("View shows a post's checklist items, read-only", async () => {
    await openInvite();
    const line = within(sheet()).getByRole("group", { name: "YouTube video" });
    await userEvent.click(within(line).getByRole("button", { name: /View/ }));
    const items = await within(line).findByRole("list", { name: "YouTube video checklist" });
    expect(within(items).getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(within(items).queryByRole("button")).toBeNull();
  });

  test("Edit checklist moves the deal back to the checklist and opens it", async () => {
    const deal = await openInvite();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Edit checklist" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/deals/${deal.id}/checklist`));
    const r = await api.getDealDraft(deal.id);
    expect(r.ok && r.data.step).toBe("checklist");
  });
});
