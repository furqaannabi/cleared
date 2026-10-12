import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { stubDealDraft } from "@/test/deal-draft";
import { aDealDraft, recordRequests } from "@/test/stub-api";
import { PostsPage } from "./posts-page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
beforeEach(() => push.mockClear());

describe("BC-FR-23 changing the posts", () => {
  test("opens filled with the deal's brand and posts, and Save changes them and returns to the checklist page", async () => {
    const deal = stubDealDraft(aDealDraft());
    deal.on("patch", "", (d) => ({ ...d, deliverables: [...d.deliverables, { id: "del_new_reel", platform: "instagram_reel" }] }));
    const sent = recordRequests();
    render(<PostsPage dealId="deal_new" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Glow Theory · Posts" })).toBeVisible();
    expect(screen.getByLabelText("Brand")).toHaveValue("Glow Theory");
    expect(screen.getByLabelText("Post 1")).toHaveValue("youtube_video");
    await userEvent.click(screen.getByRole("button", { name: "Add another post" }));
    await userEvent.selectOptions(screen.getByLabelText("Post 2"), "instagram_reel");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/deals/deal_new/checklist"));
    // The first post keeps its id; the new one has none yet.
    expect(sent).toContainEqual({
      method: "PATCH",
      path: "/deals/deal_new",
      body: { brandName: "Glow Theory", deliverables: [{ id: "del_new_video", platform: "youtube_video" }, { platform: "instagram_reel" }] },
    });
  });

  test("once the brief is sent, says the posts are set and links to the checklist page", async () => {
    stubDealDraft(aDealDraft({ reading: "reading", brief: { lines: [{ number: 1, text: "Say the code GLOW20." }] } }));
    render(<PostsPage dealId="deal_new" />);
    expect(await screen.findByText("Posts are set once the brief is read.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.getByRole("link", { name: "Back to the checklist" })).toHaveAttribute("href", "/deals/deal_new/checklist");
  });
});
