import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { DraftCheckPage } from "@/components/draft-check/draft-check-page";
import { api } from "@/lib/api";

const open = async (dealId: string, deliverableId: string) => {
  render(<DraftCheckPage dealId={dealId} deliverableId={deliverableId} />);
  return screen.findAllByRole("button", { name: "Cancel this post" });
};

describe("CN-FR-01, CN-FR-04 to CN-FR-10 the creator cancels a post (design B)", () => {
  test("the money card turns over to confirm; cancelling releases the hold and says so", async () => {
    const user = userEvent.setup();
    const [button] = await open("deal_kora", "del_kora_reel");
    await user.click(button);
    const card = screen.getByRole("region", { name: "Cancel this post?" });
    expect(card).toHaveTextContent("Would go back to Kora Audio");
    expect(card).toHaveTextContent("$800.00");
    expect(card).toHaveTextContent("This can’t be undone.");
    await user.type(within(card).getByRole("textbox", { name: "Add a note for Kora Audio (optional)" }), "Not this month.");
    expect(card).toHaveTextContent("15 / 300");
    await user.click(within(card).getByRole("button", { name: "Cancel the post" }));
    expect((await screen.findAllByText(/You cancelled this post on \d+ \w+\. The \$800\.00 hold went back to Kora Audio\./)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Cancel this post" })).toBeNull();
    expect(screen.getByText("Cancelled.")).toBeInTheDocument();
  });

  test("Keep it turns the card back and returns focus to the button", async () => {
    const user = userEvent.setup();
    const [button] = await open("deal_kora", "del_kora_reel");
    await user.click(button);
    expect(screen.getByRole("heading", { name: "Cancel this post?" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Keep it" }));
    expect(screen.queryByRole("region", { name: "Cancel this post?" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Cancel this post" })[0]).toHaveFocus();
  });

  test("CN-FR-03: with the go-ahead running, no button; the line says why", async () => {
    await api.getGoAhead("del_juniper_short");
    render(<DraftCheckPage dealId="deal_juniper" deliverableId="del_juniper_short" />);
    expect((await screen.findAllByText("You can’t cancel now: you have the go-ahead to post.")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Cancel this post" })).toBeNull();
  });

  test("CN-FR-09: a cancel that lost a race reloads the post and says why", async () => {
    const user = userEvent.setup();
    const [button] = await open("deal_kora", "del_kora_reel");
    await user.click(button);
    await api.cancelDeliverable("del_kora_reel");
    await user.click(screen.getByRole("button", { name: "Cancel the post" }));
    expect(await screen.findByText("This post was already cancelled.")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Cancel this post?" })).toBeNull();
  });
});
