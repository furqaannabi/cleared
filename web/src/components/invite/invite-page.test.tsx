import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";
import { apiBaseUrl } from "@/lib/api";
import { aReadDraft, stubDealDraft } from "@/test/deal-draft";
import { server } from "@/test/server";
import { aProfile, anInvite, recordRequests, stubDeals, stubSession, type Invite } from "@/test/stub-api";
import { stubState } from "@/test/stub-state";
import { InvitePage } from "./invite-page";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

type Post = Invite["posts"][number];
const VIDEO: Post = { deliverableId: "del_glow_video", platform: "youtube_video", itemCount: 4, cancel: { allowed: true } };
const REEL: Post = { deliverableId: "del_glow_reel", platform: "instagram_reel", itemCount: 3, cancel: { allowed: true } };
const YOUTUBE = { platform: "youtube" as const, name: "Ada Okafor" };
const INSTAGRAM = { platform: "instagram" as const, name: "ada.makes" };

/**
 * Glow Theory's invite on the page, as the API answers it: a video and a Reel,
 * YouTube connected, the PayPal email saved. Saving a post's terms or the
 * brand's email answers with them saved; `invite.on` answers anything else.
 */
async function openInvite(i: Partial<Invite> = {}, accounts: { platform: "youtube" | "instagram"; name: string }[] = [YOUTUBE]) {
  stubSession(aProfile({ paypalEmail: "ada@example.com", accounts }));
  stubDeals([]);
  const invite = stubState(`/deals/deal_glow/invite`, anInvite({ dealId: "deal_glow", brandName: "Glow Theory", posts: [VIDEO, REEL], ...i }));
  invite.on("patch", "/posts/:deliverableId", (d, { body, params }) => ({
    ...d,
    posts: d.posts.map((p) => (p.deliverableId === params.deliverableId ? { ...p, ...(body as Partial<Post>) } : p)),
  }));
  invite.on("patch", "", (d, { body }) => ({ ...d, ...(body as Partial<Invite>) }));
  render(<InvitePage dealId="deal_glow" />);
  await screen.findByRole("heading", { level: 1, name: "Glow Theory · Invite" });
  return invite;
}
const sheet = () => screen.getByRole("region", { name: "Sponsorship terms" });
const patches = (sent: ReturnType<typeof recordRequests>) => sent.filter((r) => r.method === "PATCH");

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
    await openInvite();
    const sent = recordRequests();
    const field = screen.getByRole("textbox", { name: "Amount for the YouTube video" });
    await userEvent.type(field, "1200");
    await userEvent.tab();
    await waitFor(() => expect(patches(sent)).toEqual([{ method: "PATCH", path: "/deals/deal_glow/invite/posts/del_glow_video", body: { amount: "1200.00" } }]));
    expect(field).toHaveValue("1,200.00");
  });

  test("an amount that isn't dollars is explained beside the field and not saved", async () => {
    await openInvite();
    const sent = recordRequests();
    const field = screen.getByRole("textbox", { name: "Amount for the YouTube video" });
    await userEvent.type(field, "12.345");
    await userEvent.tab();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Enter an amount in dollars, like 1200 or 1200.50");
    expect(patches(sent)).toEqual([]);
  });

  test("a failed save says so beside the field, with Try again", async () => {
    await openInvite();
    // Only the first save fails; Try again reaches the stub that saves.
    server.use(http.patch(`${apiBaseUrl}/deals/:dealId/invite/posts/:id`, () => HttpResponse.json({}, { status: 500 }), { once: true }));
    await userEvent.type(screen.getByRole("textbox", { name: "Amount for the Instagram Reel" }), "450");
    await userEvent.tab();
    const line = within(sheet()).getByRole("group", { name: "Instagram Reel" });
    expect(await within(line).findByText("We couldn’t save that.")).toBeVisible();
    await userEvent.click(within(line).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(within(line).queryByText("We couldn’t save that.")).toBeNull());
  });
});

describe("IN-FR-07 deadlines in days after the hold", () => {
  const inDays = (n: number) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(Date.now() + n * 86_400_000));

  test("typing a deadline saves it and shows the example date; + and − step it and stop at 1 and 21", async () => {
    await openInvite();
    const sent = recordRequests();
    const line = within(sheet()).getByRole("group", { name: "YouTube video" });
    const days = within(line).getByRole("spinbutton", { name: "Days after the hold for the YouTube video" });
    await userEvent.type(days, "20");
    await userEvent.tab();
    expect(await within(line).findByText(`${inDays(20)} if approved today`)).toBeVisible();
    await userEvent.click(within(line).getByRole("button", { name: "One day more for the YouTube video" }));
    expect(days).toHaveValue(21);
    expect(within(line).getByRole("button", { name: "One day more for the YouTube video" })).toBeDisabled();
    await waitFor(() => expect(patches(sent).at(-1)?.body).toEqual({ deadlineDays: 21 }));
    await userEvent.click(within(line).getByRole("button", { name: "One day fewer for the YouTube video" }));
    expect(days).toHaveValue(20);
  });

  test("more than 21 days is explained and not saved", async () => {
    await openInvite();
    const sent = recordRequests();
    const days = screen.getByRole("spinbutton", { name: "Days after the hold for the Instagram Reel" });
    await userEvent.type(days, "30");
    await userEvent.tab();
    expect(days).toHaveAccessibleDescription("Up to 21 days. PayPal only holds money for 29 days, so Cleared keeps a margin.");
    expect(patches(sent)).toEqual([]);
  });
});

describe("IN-FR-08, IN-FR-12, IN-FR-14 the rest of the sheet", () => {
  test("the total appears once every post has an amount", async () => {
    await openInvite({ posts: [{ ...VIDEO, amount: "1200.00" }, REEL] });
    expect(within(sheet()).queryByText("$1,650.00")).toBeNull();
    await userEvent.type(screen.getByRole("textbox", { name: "Amount for the Instagram Reel" }), "450");
    await userEvent.tab();
    expect(await within(sheet()).findByText("$1,650.00")).toBeVisible();
    expect(within(sheet()).getByText("Total, held as one hold per post")).toBeVisible();
  });

  test("the PayPal email is filled from the profile, warns that payments can't be pulled back, and saves a change", async () => {
    await openInvite();
    const sent = recordRequests();
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
    await waitFor(() => expect(sent).toContainEqual({ method: "PUT", path: "/me/paypal-email", body: { email: "ada.okafor@example.com" } }));
    expect(sent.filter((r) => r.path === "/me/paypal-email")).toHaveLength(1);
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
  test("lists what's done and offers Connect Instagram, the account the Reel needs; once connected it's ticked off", async () => {
    await openInvite();
    let list = within(beforeYouSend()).getByRole("list");
    expect(within(list).getByText("YouTube connected as Ada Okafor")).toBeVisible();
    expect(within(list).getByText(/Professional accounts only/)).toBeVisible();
    expect(within(list).getByRole("link", { name: "Connect Instagram" })).toHaveAttribute("href", expect.stringContaining("/connect/instagram?next="));
    // Back from connecting (IN-FR-11, 1.3): the profile now has Instagram.
    stubSession(aProfile({ paypalEmail: "ada@example.com", accounts: [YOUTUBE, INSTAGRAM] }));
    cleanup();
    render(<InvitePage dealId="deal_glow" />);
    list = within(await screen.findByRole("region", { name: "Before you send" })).getByRole("list");
    expect(await within(list).findByText("Instagram connected as ada.makes")).toBeVisible();
    expect(within(list).queryByRole("link", { name: "Connect Instagram" })).toBeNull();
  });

  test("the brand's email is optional and saves when given", async () => {
    await openInvite();
    const sent = recordRequests();
    const email = within(beforeYouSend()).getByRole("textbox", { name: "Glow Theory’s email (optional)" });
    await userEvent.type(email, "sam@glowtheory.com");
    await userEvent.tab();
    await waitFor(() => expect(patches(sent)).toEqual([{ method: "PATCH", path: "/deals/deal_glow/invite", body: { brandEmail: "sam@glowtheory.com" } }]));
  });
});

const LINK = { url: "https://cleared.example/b/tok_glow", expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(), expired: false };

/** Every term in place: amounts, deadlines, both accounts, the PayPal email. Creating the link answers with it. */
async function openFilledInvite(brandEmail?: string) {
  const invite = await openInvite(
    { posts: [{ ...VIDEO, amount: "1200.00", deadlineDays: 14 }, { ...REEL, amount: "450.00", deadlineDays: 10 }], ...(brandEmail ? { brandEmail } : {}) },
    [YOUTUBE, INSTAGRAM],
  );
  invite.on("post", "/link", (d) => ({ ...d, step: "waiting_for_brand", link: LINK }));
  return invite;
}

describe("IN-FR-16, IN-FR-17 creating the link", () => {
  test("Create link locks the terms and shows the link, who can open it and when it expires; it is never emailed (1.3)", async () => {
    const user = userEvent.setup();
    await openFilledInvite("sam@glowtheory.com");
    await user.click(screen.getByRole("button", { name: "Create link for Glow Theory" }));
    const panel = await screen.findByRole("region", { name: "Send this link to Glow Theory" });
    const url = within(panel).getByText(/^https:\/\/cleared\.example\/b\//);
    expect(within(panel).getByText("Anyone with this link can open this deal. Send it only to Glow Theory.")).toBeVisible();
    expect(within(panel).getByText(/^Expires on \d{1,2} \w{3}\.$/)).toBeVisible();
    expect(within(panel).queryByText(/emailed/)).toBeNull();
    expect(within(sheet()).queryByRole("textbox")).toBeNull();
    expect(within(sheet()).getByText("Within 14 days of the hold")).toBeVisible();
    expect(within(sheet()).getByText("$1,200.00")).toBeVisible();
    expect(screen.getByText(/waiting for them to confirm the checklist and approve the holds/)).toBeVisible();

    await user.click(within(panel).getByRole("button", { name: "Copy link" }));
    expect(await navigator.clipboard.readText()).toBe(url.textContent);
    expect(within(panel).getByText("Copied")).toHaveAttribute("role", "status");
  });

  test("Create link does nothing while something is left", async () => {
    await openInvite();
    const sent = recordRequests();
    await userEvent.click(screen.getByRole("button", { name: "Create link for Glow Theory" }));
    expect(sent.filter((r) => r.method === "POST")).toEqual([]);
  });
});

describe("IN-FR-18, IN-FR-19 a new link, and changing the terms", () => {
  async function withLink() {
    const invite = await openFilledInvite();
    invite.on("post", "/link/renew", (d) => ({ ...d, link: { ...LINK, url: "https://cleared.example/b/tok_glow_2" } }));
    invite.on("delete", "/link", ({ link: _, ...d }) => (void _, { ...d, step: "invite" }));
    await userEvent.click(screen.getByRole("button", { name: "Create link for Glow Theory" }));
    return screen.findByRole("region", { name: "Send this link to Glow Theory" });
  }

  test("Make a new link asks first, then replaces the link", async () => {
    const panel = await withLink();
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
    await withLink();
    const sent = recordRequests();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Change terms" }));
    expect(within(sheet()).getByText("Glow Theory’s link will stop working. You’ll make a new one when you’re done.")).toBeVisible();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Yes, change terms" }));
    expect(await screen.findByRole("textbox", { name: "Amount for the YouTube video" })).toHaveValue("1,200.00");
    expect(screen.queryByRole("region", { name: "Send this link to Glow Theory" })).toBeNull();
    expect(sent).toContainEqual({ method: "DELETE", path: "/deals/deal_glow/invite/link" });
  });
});

describe("IN-FR-20 an expired link", () => {
  test("says the link has expired and offers a new one", async () => {
    await openInvite({ step: "waiting_for_brand", posts: [{ ...VIDEO, amount: "1200.00", deadlineDays: 14 }], link: { ...LINK, expired: true } });
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
    stubDealDraft(aReadDraft({ step: "invite", ready: true }));
    await openInvite();
    const line = within(sheet()).getByRole("group", { name: "YouTube video" });
    await userEvent.click(within(line).getByRole("button", { name: /View/ }));
    const items = await within(line).findByRole("list", { name: "YouTube video checklist" });
    expect(within(items).getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(within(items).queryByRole("button")).toBeNull();
  });

  test("Edit checklist moves the deal back to the checklist and opens it", async () => {
    const deal = stubDealDraft(aReadDraft({ step: "invite", ready: true }));
    deal.on("post", "/checklist/reopen", (d) => ({ ...d, step: "checklist", ready: false }));
    await openInvite();
    const sent = recordRequests();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Edit checklist" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/deals/deal_glow/checklist"));
    expect(sent).toContainEqual({ method: "POST", path: "/deals/deal_glow/checklist/reopen" });
  });
});

describe("BC-FR-22 going back from the invite page", () => {
  test("Brief and Checklist link back; Posts is set", async () => {
    await openInvite();
    const steps = screen.getByRole("list", { name: "New deal steps" });
    expect(within(steps).getByRole("link", { name: /Checklist/ })).toHaveAttribute("href", "/deals/deal_glow/checklist");
    expect(within(steps).getByRole("link", { name: /Brief/ })).toHaveAttribute("href", "/deals/deal_glow/checklist#brief");
    expect(within(steps).queryByRole("link", { name: /Posts/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Glow Theory" })).toHaveAttribute("href", "/deals/deal_glow");
  });
});
