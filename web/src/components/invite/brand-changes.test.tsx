import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { aReadDraft, stubDealDraft } from "@/test/deal-draft";
import { aProfile, anInvite, recordRequests, stubDeals, stubSession, type Invite } from "@/test/stub-api";
import { stubState } from "@/test/stub-state";
import { InvitePage } from "./invite-page";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

type Post = Invite["posts"][number];
const POSTS: Post[] = [
  { deliverableId: "del_maple_video", platform: "youtube_video", itemCount: 5, amount: "1200.00", deadlineDays: 14, cancel: { allowed: true } },
  { deliverableId: "del_maple_reel", platform: "instagram_reel", itemCount: 4, amount: "450.00", deadlineDays: 10, cancel: { allowed: true } },
  { deliverableId: "del_maple_short", platform: "youtube_short", itemCount: 3, amount: "300.00", deadlineDays: 7, cancel: { allowed: true } },
];
const LINK = { url: "https://sponing.example/b/tok_maple", expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(), expired: false };
const ACCOUNTS = [
  { platform: "youtube" as const, name: "Ada Okafor", inUse: false },
  { platform: "instagram" as const, name: "ada.makes", inUse: false },
];

/** Maple & Moss's deal on the creator's invite page, as the API answers it; override any field. */
function stubMaple(i: Partial<Invite> = {}) {
  stubSession(aProfile({ paypalEmail: "ada@example.com", accounts: ACCOUNTS }));
  stubDeals([]);
  stubDealDraft(
    aReadDraft({
      id: "deal_maple",
      brandName: "Maple & Moss",
      step: "changes_requested",
      ready: true,
      deliverables: POSTS.map((p) => ({ id: p.deliverableId, platform: p.platform })),
      items: [{ id: "it_maple_link", deliverableId: "del_maple_video", name: "maplemoss.com/ada in the description", kind: "written", briefLine: 1, addedByCreator: false, checkedBy: "exact_match" }],
      questions: [],
    }),
  );
  return stubState(
    "/deals/deal_maple/invite",
    anInvite({ dealId: "deal_maple", brandName: "Maple & Moss", step: "waiting_for_brand", posts: POSTS, version: 1, link: LINK, ...i }),
  );
}

/** Maple & Moss sent two notes: one about an item, one about the Reel's amount. */
async function changesAsked() {
  const invite = stubMaple({
    step: "changes_requested",
    notes: [
      { id: "note_link", about: { kind: "item", itemId: "it_maple_link" }, text: "Use maplemoss.com/ada-okafor.", version: 1 },
      { id: "note_reel", about: { kind: "amount", deliverableId: "del_maple_reel" }, text: "We said $400.", version: 1 },
    ],
  });
  render(<InvitePage dealId="deal_maple" />);
  await screen.findByRole("heading", { name: "Maple & Moss asked for 2 changes" });
  return invite;
}
const changes = () => screen.getByRole("region", { name: "Maple & Moss asked for 2 changes" });
const sheet = () => screen.getByRole("region", { name: "Sponsorship terms" });

describe("CH-FR-22 the brand's notes, in place", () => {
  test("lists each note with what it's about, puts amount notes beside their post, and opens the terms for editing", async () => {
    await changesAsked();
    expect(await within(changes()).findByText("maplemoss.com/ada in the description (YouTube video)")).toBeVisible();
    expect(within(changes()).getByText("Use maplemoss.com/ada-okafor.")).toBeVisible();
    expect(within(within(sheet()).getByRole("group", { name: "Instagram Reel" })).getByText("“We said $400.”").closest("p")).toHaveTextContent("Maple & Moss: “We said $400.”");
    expect(screen.getByRole("textbox", { name: "Amount for the Instagram Reel" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Edit checklist" })).toBeVisible();
  });
});

describe("CH-FR-23 replying", () => {
  test("a reply saves under its note", async () => {
    const invite = await changesAsked();
    invite.at("put", "/deals/deal_maple/notes/:noteId/reply", (d, { body, params }) => ({
      ...d,
      notes: d.notes?.map((n) => (n.id === params.noteId ? { ...n, reply: (body as { reply: string }).reply } : n)),
    }));
    const sent = recordRequests();
    await userEvent.click(await within(changes()).findByRole("button", { name: "Reply about the amount for the Instagram Reel" }));
    await userEvent.type(within(changes()).getByRole("textbox", { name: "Your reply about the amount for the Instagram Reel" }), "Fixed it to $400.");
    await userEvent.click(within(changes()).getByRole("button", { name: "Save reply" }));
    expect(await within(changes()).findByText("Fixed it to $400.")).toBeVisible();
    expect(sent).toContainEqual({ method: "PUT", path: "/deals/deal_maple/notes/note_reel/reply", body: { reply: "Fixed it to $400." } });
  });
});

describe("CH-FR-24 sending updated terms", () => {
  test("sends version 2 to the same link", async () => {
    const invite = await changesAsked();
    invite.on("post", "/send", (d) => ({ ...d, step: "waiting_for_brand", version: 2 }));
    await userEvent.click(screen.getByRole("button", { name: "Send updated terms to Maple & Moss" }));
    expect(await screen.findByText("Version 2 sent")).toBeVisible();
    expect(screen.getByRole("region", { name: "Send this link to Maple & Moss" })).toBeVisible();
    expect(screen.queryByRole("region", { name: /asked for/ })).toBeNull();
  });

  test("is held back like Create link while an account the posts need isn't connected", async () => {
    stubMaple({ step: "changes_requested", notes: [] });
    stubSession(aProfile({ paypalEmail: "ada@example.com", accounts: ACCOUNTS.slice(0, 1) }));
    render(<InvitePage dealId="deal_maple" />);
    const send = await screen.findByRole("button", { name: "Send updated terms to Maple & Moss" });
    await waitFor(() => expect(send).toHaveAttribute("aria-disabled", "true"));
  });
});

describe("CH-FR-25 holds, for the creator", () => {
  test("a held post shows its reference, the date to post by and its draft check; one not held says who has to act", async () => {
    stubMaple({
      step: "agreed",
      posts: [
        { ...POSTS[0], hold: { state: "held", reference: "7HK21934LM", deadline: "2026-10-26" } },
        { ...POSTS[1], hold: { state: "not_started" } },
        { ...POSTS[2], hold: { state: "not_started" } },
      ],
    });
    render(<InvitePage dealId="deal_maple" />);
    const video = within(await screen.findByRole("region", { name: "Sponsorship terms" })).getByRole("group", { name: "YouTube video" });
    expect(within(video).getByText("Held · $1,200.00 · PayPal ref 7HK21934LM · Post by 26 Oct")).toBeVisible();
    expect(within(video).getByRole("link", { name: "Open draft check" })).toHaveAttribute("href", "/deals/deal_maple/deliverables/del_maple_video");
    const reel = within(sheet()).getByRole("group", { name: "Instagram Reel" });
    expect(within(reel).getByText("Waiting for Maple & Moss to approve this hold. You can start on the posts that are held.")).toBeVisible();
    expect(screen.getByText("Maple & Moss agreed · 1 of 3 held")).toBeVisible();
  });
});
