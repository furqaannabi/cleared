import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";
import { DraftCheckPage } from "@/components/draft-check/draft-check-page";
import { http } from "msw";
import { apiBaseUrl } from "@/lib/api";
import type { Deliverable } from "@/lib/deliverable/types";
import { seededPosts, stubPosts } from "@/test/creator-posts";
import { juniperDeliverables } from "@/test/fixtures/juniper";
import { server } from "@/test/server";
import { apiError } from "@/test/stub-api";

const kora = (): Deliverable => ({ ...seededPosts().find((d) => d.id === "del_kora_reel")!, cancel: { allowed: true } });
/** The post as cancelled by the creator, with the note sent. */
const cancelled = (d: Deliverable, note?: string): Deliverable => ({
  ...d,
  state: "released",
  releasedAt: new Date().toISOString(),
  releaseReason: "cancelled",
  cancel: { allowed: false, reason: "finished" },
  cancelled: { by: "creator", at: new Date().toISOString(), ...(note ? { note } : {}) },
});
let posts: ReturnType<typeof stubPosts>;
beforeEach(() => {
  posts = stubPosts(kora());
  posts.on("del_kora_reel", "post", "/cancel", (d, { body }) => cancelled(d, (body as { note?: string }).note));
});

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
    const short = juniperDeliverables(Date.now()).find((d) => d.id === "del_juniper_short")!;
    stubPosts({ ...short, state: "posting", goAhead: { state: "go", endsAt: new Date(Date.now() + 48 * 3_600_000).toISOString() }, cancel: { allowed: false, reason: "go_ahead_running" } });
    render(<DraftCheckPage dealId="deal_juniper" deliverableId="del_juniper_short" />);
    expect((await screen.findAllByText("You can’t cancel now: you have the go-ahead to post.")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Cancel this post" })).toBeNull();
  });

  test("CN-FR-09: a cancel that lost a race reloads the post and says why", async () => {
    const user = userEvent.setup();
    const [button] = await open("deal_kora", "del_kora_reel");
    await user.click(button);
    // The brand cancelled it first: this cancel is refused, and the post now reads as cancelled.
    stubPosts({ ...cancelled(kora()), cancelled: { by: "brand", at: new Date().toISOString() } });
    server.use(http.post(`${apiBaseUrl}/deliverables/del_kora_reel/cancel`, () => apiError({ code: "already_cancelled" }, 409)));
    await user.click(screen.getByRole("button", { name: "Cancel the post" }));
    expect(await screen.findByText("This post was already cancelled.")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Cancel this post?" })).toBeNull();
  });
});
