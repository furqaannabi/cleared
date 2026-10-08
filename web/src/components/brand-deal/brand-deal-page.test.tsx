import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { api, apiBaseUrl } from "@/lib/api";
import { server } from "@/mocks/node";
import { BrandDealPage } from "./brand-deal-page";

/** The seeded demo deal (Maple & Moss), opened from its link. */
async function openDeal() {
  await api.openBrandLink("demo_maple");
  render(<BrandDealPage dealId="deal_maple" />);
  await screen.findByRole("heading", { level: 1, name: "Your deal with Ada Okafor" });
}
const sheet = () => screen.getByRole("region", { name: "Sponsorship terms" });
const post = (name: string) => within(sheet()).getByRole("group", { name });

describe("CH-FR-03 no session", () => {
  test("asks for the link again, and never offers sign-in", async () => {
    render(<BrandDealPage dealId="deal_maple" />);
    expect(await screen.findByRole("heading", { name: "Open the link you were sent again" })).toBeVisible();
    expect(screen.queryByText(/sign in/i)).toBeNull();
  });
});

describe("CH-FR-04, CH-FR-05 the frame and the terms", () => {
  test("says who invited whom, and shows each post, its deadline after the hold, its amount and the total", async () => {
    await openDeal();
    expect(screen.getByText(/invited/).textContent).toBe("Ada Okafor invited Maple & Moss");
    expect(within(sheet()).getAllByRole("group").map((g) => g.getAttribute("aria-label"))).toEqual(["YouTube video", "Instagram Reel", "YouTube Short"]);
    expect(within(post("YouTube video")).getByText("$1,200.00")).toBeVisible();
    expect(within(post("YouTube video")).getByText(/Within 14 days of your hold/)).toBeVisible();
    expect(within(sheet()).getByText("$1,950.00")).toBeVisible();
    expect(within(sheet()).getByText("Paid to Ada Okafor’s PayPal.")).toBeVisible();
  });

  test("states the four payment rules from the brand's side", async () => {
    await openDeal();
    const rules = screen.getByRole("list", { name: "How payment works" });
    expect(within(rules).getAllByRole("listitem")[0]).toHaveTextContent("You approve a hold for each post. The money is reserved, not taken.");
    expect(within(rules).getAllByRole("listitem")[3]).toHaveTextContent("If Ada Okafor misses the deadline, the hold comes back to you.");
  });
});

describe("CH-FR-06 to CH-FR-09 the checklist and where it came from", () => {
  test("each item quotes its brief line, and one the creator added says so", async () => {
    await openDeal();
    const video = post("YouTube video");
    const code = within(video).getByRole("listitem", { name: "Says the code MOSS10" });
    expect(code).toHaveTextContent("From your brief: “Say and show the code MOSS10.”");
    expect(within(video).getByRole("listitem", { name: "maplemoss.com/ada in the description" })).toHaveTextContent("Added by Ada Okafor");
  });

  test("an item from a line the creator settled says how they read it", async () => {
    await openDeal();
    const reel = post("Instagram Reel");
    expect(within(reel).getByText(/read it as/)).toHaveTextContent("You wrote “Mention us early in the Reel.” Ada Okafor read it as “In the first 10 seconds”.");
  });

  test("lists the lines that won't be checked, marking the one the creator left out", async () => {
    await openDeal();
    const left = screen.getByRole("region", { name: "Not on the checklist" });
    expect(within(left).getByText("These won’t be checked.")).toBeVisible();
    expect(within(left).getByText("“Thanks for partnering with Maple & Moss on the Ember candle launch!”")).toBeVisible();
    expect(within(left).getByText("“Keep it fun and cosy!”").parentElement).toHaveTextContent("Ada Okafor left this out.");
  });

  test("on phones each checklist folds behind a View button that says how many items it holds", async () => {
    await openDeal();
    const toggle = within(post("YouTube video")).getByRole("button", { name: "View all 5 items" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(within(post("YouTube video")).getByRole("button", { name: "Hide items" })).toHaveAttribute("aria-expanded", "true");
  });

  test("CH-BR-08: the creator's PayPal email appears nowhere", async () => {
    await openDeal();
    expect(document.body.textContent).not.toContain("ada@example.com");
  });
});

describe("CH-FR-10, CH-FR-11 asking for a change", () => {
  test("a note on an item opens in place, saves beside it, and the panel offers to send it", async () => {
    await openDeal();
    const item = () => within(post("YouTube video")).getByRole("listitem", { name: "Says the code MOSS10" });
    await userEvent.click(within(item()).getByRole("button", { name: "Ask for a change to Says the code MOSS10 (YouTube video)" }));
    const field = within(item()).getByRole("textbox", { name: "Your note about Says the code MOSS10 (YouTube video)" });
    expect(field).toHaveFocus();
    await userEvent.type(field, "Use MOSS15, please.");
    expect(within(item()).getByText("19 of 500")).toBeVisible();
    await userEvent.click(within(item()).getByRole("button", { name: "Save note" }));
    expect(within(item()).getByText("Use MOSS15, please.")).toBeVisible();
    const panel = screen.getByRole("region", { name: "Your notes for Ada Okafor" });
    expect(within(panel).getByText("Use MOSS15, please.")).toBeVisible();
    expect(within(panel).getByRole("button", { name: "Send 1 change to Ada Okafor" })).toBeVisible();
  });
});

/** Writes and saves a note through the button with this name. */
async function note(button: string, field: string, text: string) {
  await userEvent.click(screen.getByRole("button", { name: button }));
  await userEvent.type(screen.getByRole("textbox", { name: field }), text);
  await userEvent.click(screen.getByRole("button", { name: "Save note" }));
}

describe("CH-FR-10 to CH-FR-12 notes, then sending them", () => {
  test("a saved note can be edited and removed", async () => {
    await openDeal();
    await note("Ask for a change to Says the code MOSS10 (YouTube video)", "Your note about Says the code MOSS10 (YouTube video)", "Use MOSS15.");
    await userEvent.click(screen.getByRole("button", { name: "Edit your note about Says the code MOSS10 (YouTube video)" }));
    const field = screen.getByRole("textbox", { name: "Your note about Says the code MOSS10 (YouTube video)" });
    expect(field).toHaveValue("Use MOSS15.");
    await userEvent.type(field, " Thanks!");
    await userEvent.click(screen.getByRole("button", { name: "Save note" }));
    expect(screen.getAllByText("Use MOSS15. Thanks!")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Remove your note about Says the code MOSS10 (YouTube video)" }));
    expect(screen.queryByText("Use MOSS15. Thanks!")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Send/ })).toBeNull();
  });

  test("notes can be about a line left out, a post's amount or deadline, and the deal as a whole", async () => {
    await openDeal();
    await note("Ask for a change to “Keep it fun and cosy!”", "Your note about “Keep it fun and cosy!”", "We do need this.");
    await note("Ask about the amount for the YouTube video", "Your note about the amount for the YouTube video", "We said $1,100.");
    await note("Ask about the deadline for the Instagram Reel", "Your note about the deadline for the Instagram Reel", "7 days, please.");
    await note("Anything else about this deal?", "Your note about this deal", "We agreed four posts.");
    expect(screen.getByRole("button", { name: "Send 4 changes to Ada Okafor" })).toBeVisible();
  });

  test("sending moves the page to waiting for the creator, with the notes read-only and nothing left to ask or agree", async () => {
    await openDeal();
    await note("Ask for a change to Says the code MOSS10 (YouTube video)", "Your note about Says the code MOSS10 (YouTube video)", "Use MOSS15.");
    await userEvent.click(screen.getByRole("button", { name: "Send 1 change to Ada Okafor" }));
    expect(await screen.findByText("Sent to Ada Okafor. When they update the terms, this page shows the new version. You can close it.")).toBeVisible();
    const sent = screen.getByRole("region", { name: "Your notes for Ada Okafor" });
    expect(within(sent).getByText("Use MOSS15.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Ask/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Agree/ })).toBeNull();
  });
});

describe("CH-FR-14 to CH-FR-16 agreeing", () => {
  test("the summary sits above Agree; agreeing marks the version and date, and nothing can be asked any more", async () => {
    await openDeal();
    const agree = screen.getByRole("region", { name: "Agree" });
    expect(within(agree).getByText("You’re agreeing to the checklist for 3 posts, $1,950.00 in total (one hold per post), and how payment works.")).toBeVisible();
    await userEvent.click(within(agree).getByRole("button", { name: "Agree to these terms" }));
    expect(await screen.findByText(/^Agreed · version 1 · \d{1,2} \w{3}$/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Ask/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Agree/ })).toBeNull();
  });

  test("with notes not sent, the button says so, and agreeing drops them", async () => {
    await openDeal();
    await note("Anything else about this deal?", "Your note about this deal", "Could we add a Short?");
    await userEvent.click(screen.getByRole("button", { name: "Agree without sending your 1 note?" }));
    expect(await screen.findByText(/^Agreed · version 1/)).toBeVisible();
    expect(screen.queryByText("Could we add a Short?")).toBeNull();
    const d = await api.getBrandDeal("deal_maple");
    expect(d.ok && d.data.notes).toEqual([]);
  });

  test("CH-FR-15: an out-of-date version is refused, and the page reloads the new one and says why", async () => {
    await openDeal();
    const now = await api.getBrandDeal("deal_maple");
    if (!now.ok) throw new Error(now.error);
    server.use(
      http.post(`${apiBaseUrl}/brand/deals/:dealId/agree`, () => HttpResponse.json({ message: "Out of date" }, { status: 409 }), { once: true }),
      http.get(`${apiBaseUrl}/brand/deals/:dealId`, () => HttpResponse.json({ ...now.data, version: 2 })),
    );
    await userEvent.click(screen.getByRole("button", { name: "Agree to these terms" }));
    expect(await screen.findByText("Ada Okafor updated the terms. Check the changes before agreeing.")).toBeVisible();
    expect(screen.getByText("Version 2")).toBeVisible();
  });
});

describe("CH-FR-13 the new version", () => {
  test("marks what changed and shows each earlier note with the creator's reply", async () => {
    await api.openBrandLink("demo_maple");
    const now = await api.getBrandDeal("deal_maple");
    if (!now.ok) throw new Error(now.error);
    const items = now.data.items.map((i) => (i.id === "it_maple_link" ? { ...i, changed: true } : i));
    const posts = now.data.posts.map((p, n) => (n === 1 ? { ...p, changed: ["amount" as const] } : p));
    const notes = [{ id: "n1", about: { kind: "item" as const, itemId: "it_maple_link" }, text: "Use our tracking link.", reply: "Done, it’s maplemoss.com/ada.", version: 1 }];
    server.use(http.get(`${apiBaseUrl}/brand/deals/:dealId`, () => HttpResponse.json({ ...now.data, version: 2, items, posts, notes })));
    render(<BrandDealPage dealId="deal_maple" />);
    expect(await screen.findByText("Version 2")).toBeVisible();
    expect(within(post("YouTube video")).getByRole("listitem", { name: "maplemoss.com/ada in the description" })).toHaveTextContent("Changed");
    expect(within(post("Instagram Reel")).getByText("Amount changed")).toBeVisible();
    const panel = screen.getByRole("region", { name: "Your notes for Ada Okafor" });
    expect(within(panel).getByText("Use our tracking link.")).toBeVisible();
    expect(within(panel).getByText("Done, it’s maplemoss.com/ada.")).toBeVisible();
  });
});
