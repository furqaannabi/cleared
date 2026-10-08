import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { DemoBuildProvider } from "@/components/mocking/demo-build";
import { api } from "@/lib/api";
import { InvitePage } from "./invite-page";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

/** The demo deal after Maple & Moss sent two notes, on the creator's invite page. */
async function changesAsked() {
  await api.openBrandLink("demo_maple");
  await api.sendChanges("deal_maple", [
    { about: { kind: "item", itemId: "it_maple_link" }, text: "Use maplemoss.com/ada-okafor." },
    { about: { kind: "amount", deliverableId: "del_maple_reel" }, text: "We said $400." },
  ]);
  render(<InvitePage dealId="deal_maple" />);
  await screen.findByRole("heading", { name: "Maple & Moss asked for 2 changes" });
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
    await changesAsked();
    await userEvent.click(await within(changes()).findByRole("button", { name: "Reply about the amount for the Instagram Reel" }));
    await userEvent.type(within(changes()).getByRole("textbox", { name: "Your reply about the amount for the Instagram Reel" }), "Fixed it to $400.");
    await userEvent.click(within(changes()).getByRole("button", { name: "Save reply" }));
    expect(await within(changes()).findByText("Fixed it to $400.")).toBeVisible();
    const invite = await api.getInvite("deal_maple");
    expect(invite.ok && invite.data.notes?.[1].reply).toBe("Fixed it to $400.");
  });
});

describe("CH-FR-24 sending updated terms", () => {
  test("is held back like Create link, then sends version 2 to the same link", async () => {
    await changesAsked();
    const send = screen.getByRole("button", { name: "Send updated terms to Maple & Moss" });
    expect(send).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(screen.getByRole("button", { name: "Connect Instagram" }));
    await userEvent.click(send);
    expect(await screen.findByText("Version 2 sent")).toBeVisible();
    expect(screen.getByRole("region", { name: "Send this link to Maple & Moss" })).toBeVisible();
    expect(screen.queryByRole("region", { name: /asked for/ })).toBeNull();
  });
});

describe("CH-FR-25 holds, for the creator", () => {
  test("a held post shows its reference, the date to post by and its draft check; one not held says who has to act", async () => {
    await api.openBrandLink("demo_maple");
    await api.agree("deal_maple", 1);
    const s = await api.startHold("deal_maple", "del_maple_video");
    if (!s.ok) throw new Error(s.error);
    await api.confirmHold("deal_maple", "del_maple_video", s.data.orderId);
    render(<InvitePage dealId="deal_maple" />);
    const video = within(await screen.findByRole("region", { name: "Sponsorship terms" })).getByRole("group", { name: "YouTube video" });
    expect(within(video).getByText(/^Held · \$1,200\.00 · PayPal ref DEMO-\w+ · Post by \d{1,2} \w{3}$/)).toBeVisible();
    expect(within(video).getByRole("link", { name: "Open draft check" })).toHaveAttribute("href", "/deals/deal_maple/deliverables/del_maple_video");
    const reel = within(sheet()).getByRole("group", { name: "Instagram Reel" });
    expect(within(reel).getByText("Waiting for Maple & Moss to approve this hold. You can start on the posts that are held.")).toBeVisible();
    expect(screen.getByText("Maple & Moss agreed · 1 of 3 held")).toBeVisible();
  });
});

describe("Mocks: open the link as the brand", () => {
  test("in a mock build, the link panel opens the brand's side in this browser", async () => {
    await api.openBrandLink("demo_maple");
    render(
      <DemoBuildProvider>
        <InvitePage dealId="deal_maple" />
      </DemoBuildProvider>,
    );
    const panel = await screen.findByRole("region", { name: "Send this link to Maple & Moss" });
    expect(within(panel).getByRole("link", { name: "Open as Maple & Moss" })).toHaveAttribute("href", "/b/demo_maple");
  });

  test("outside a mock build there is no such link", async () => {
    render(<InvitePage dealId="deal_maple" />);
    const panel = await screen.findByRole("region", { name: "Send this link to Maple & Moss" });
    expect(within(panel).queryByRole("link", { name: /Open as/ })).toBeNull();
  });
});
