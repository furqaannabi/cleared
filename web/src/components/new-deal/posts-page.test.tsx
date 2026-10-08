import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "@/lib/api";
import { setReadingSpeed } from "@/mocks/deal-drafts";
import { PostsPage } from "./posts-page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
beforeEach(() => push.mockClear());

async function newDeal() {
  const r = await api.createDeal({ brandName: "Glow Theory", deliverables: [{ platform: "youtube_video" }] });
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

describe("BC-FR-23 changing the posts", () => {
  test("opens filled with the deal's brand and posts, and Save changes them and returns to the checklist page", async () => {
    const d = await newDeal();
    render(<PostsPage dealId={d.id} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Glow Theory · Posts" })).toBeVisible();
    expect(screen.getByLabelText("Brand")).toHaveValue("Glow Theory");
    expect(screen.getByLabelText("Post 1")).toHaveValue("youtube_video");
    await userEvent.click(screen.getByRole("button", { name: "Add another post" }));
    await userEvent.selectOptions(screen.getByLabelText("Post 2"), "instagram_reel");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith(`/deals/${d.id}/checklist`));
    const r = await api.getDealDraft(d.id);
    expect(r.ok && r.data.deliverables.map((x) => x.platform)).toEqual(["youtube_video", "instagram_reel"]);
    expect(r.ok && r.data.deliverables[0].id).toBe(d.deliverables[0].id);
  });

  test("once the brief is sent, says the posts are set and links to the checklist page", async () => {
    setReadingSpeed(60_000);
    const d = await newDeal();
    await api.submitBrief(d.id, "In the YouTube video, say “Glow Theory” in the first 60 seconds.\nSay the code GLOW20.");
    render(<PostsPage dealId={d.id} />);
    expect(await screen.findByText("Posts are set once the brief is read.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.getByRole("link", { name: "Back to the checklist" })).toHaveAttribute("href", `/deals/${d.id}/checklist`);
  });
});
