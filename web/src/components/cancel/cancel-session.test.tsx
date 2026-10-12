import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { ApiResult } from "@/lib/api";
import { CancelDeal } from "./cancel-deal";
import { CancelPost } from "./cancel-post";

/* CN-FR-19 (1.2): the API answers 401 to cancelling; the card stays, the note stays, and the line says the session ended. */

const signedOut = async (): Promise<ApiResult<{ cancelled?: unknown }>> => ({ ok: false, error: "signed_out" });
const BRAND = "Your access to this deal has ended. Open the link Ada Okafor sent you, then try again here.";
const CREATOR = "You’ve been signed out. Sign in again to carry on.";

describe("CN-FR-19 cancelling one post when the session ended", () => {
  test.each([
    ["brand", BRAND],
    ["creator", CREATOR],
  ] as const)("the %s's card stays open with the note, and says why", async (side, line) => {
    render(
      <CancelPost
        post={{ cancel: { allowed: true }, brandName: "Kora Audio", platform: "youtube_video", amount: "$800.00" }}
        side={side}
        creatorName="Ada Okafor"
        send={signedOut}
        reload={vi.fn(async () => null)}
        onUpdated={vi.fn()}
      >
        <p>Money</p>
      </CancelPost>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel this post" }));
    const card = screen.getByRole("region", { name: "Cancel this post?" });
    const note = within(card).getByRole("textbox");
    await userEvent.type(note, "Not this month.");
    await userEvent.click(within(card).getByRole("button", { name: "Cancel the post" }));
    expect(await within(card).findByText(line)).toBeVisible();
    expect(note).toHaveValue("Not this month.");
    expect(screen.queryByText("That didn’t go through. Try again.")).toBeNull();
  });
});

describe("CN-FR-19 cancelling the deal when the session ended", () => {
  test.each([
    ["brand", BRAND],
    ["creator", CREATOR],
  ] as const)("the %s's card stays open with the note, and says why", async (side, line) => {
    const posts = ["del_a", "del_b"].map((deliverableId) => ({ deliverableId, platform: "youtube_video" as const, amount: "800.00", held: true, cancel: { allowed: true as const } }));
    render(<CancelDeal posts={posts} side={side} brandName="Kora Audio" creatorName="Ada Okafor" sendOne={signedOut} onUpdated={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel the deal" }));
    const card = screen.getByRole("region", { name: "Cancel the deal?" });
    const note = within(card).getByRole("textbox");
    await userEvent.type(note, "Pausing.");
    await userEvent.click(within(card).getByRole("button", { name: "Cancel the deal" }));
    expect(await within(card).findByText(line)).toBeVisible();
    expect(note).toHaveValue("Pausing.");
  });
});
