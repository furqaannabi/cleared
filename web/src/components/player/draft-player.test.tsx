import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { deliverableView } from "@/lib/deliverable/deliverable-view";
import { glowTheoryVideo } from "@/mocks/fixtures/deliverables";
import { DraftPlayer } from "./draft-player";

const view = deliverableView(glowTheoryVideo, new Date("2026-10-06T12:00:00Z"));
const draft = glowTheoryVideo.draft!;
const props = {
  draft,
  items: view.items,
  brandName: "Glow Theory",
  onSelect: () => {},
  refreshUrl: async () => null,
};

afterEach(() => vi.restoreAllMocks());

describe("DC-FR-23, DC-FR-25 draft player", () => {
  test("plays the draft from the API's link, labelled with its file name", () => {
    render(<DraftPlayer {...props} platform="youtube_video" selectedId={null} />);
    const video = screen.getByLabelText("Draft video draft_v2.mp4");
    expect(video.tagName).toBe("VIDEO");
    expect(video).toHaveAttribute("src", "/mock-media/synthetic-draft-16x9.mp4");
  });

  test("is 16:9 for a YouTube video and 9:16 for Shorts and Reels", () => {
    const { unmount } = render(<DraftPlayer {...props} platform="youtube_video" selectedId={null} />);
    expect(screen.getByTestId("draft-frame")).toHaveAttribute("data-aspect", "16:9");
    unmount();
    render(<DraftPlayer {...props} platform="instagram_reel" selectedId={null} />);
    expect(screen.getByTestId("draft-frame")).toHaveAttribute("data-aspect", "9:16");
  });

  test("DC-FR-22: selecting an item moves the video to its moment", () => {
    const seek = vi.fn();
    vi.spyOn(HTMLMediaElement.prototype, "currentTime", "set").mockImplementation(seek);
    const { rerender } = render(<DraftPlayer {...props} platform="youtube_video" selectedId={null} />);
    rerender(<DraftPlayer {...props} platform="youtube_video" selectedId="it_5" />);
    expect(seek).toHaveBeenLastCalledWith(195);
  });

  test("DC-FR-26: an expired link is swapped for a fresh one without interrupting", async () => {
    const refreshUrl = vi.fn(async () => "/mock-media/fresh.mp4");
    render(<DraftPlayer {...props} platform="youtube_video" selectedId={null} refreshUrl={refreshUrl} />);
    fireEvent.error(screen.getByLabelText("Draft video draft_v2.mp4"));
    expect(await screen.findByLabelText("Draft video draft_v2.mp4")).toHaveAttribute("src", "/mock-media/fresh.mp4");
    expect(refreshUrl).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("DC-FR-26: if a fresh link can't be had, it says so plainly and offers Try again", async () => {
    const refreshUrl = vi.fn(async () => null);
    render(<DraftPlayer {...props} platform="youtube_video" selectedId={null} refreshUrl={refreshUrl} />);
    fireEvent.error(screen.getByLabelText("Draft video draft_v2.mp4"));
    expect(await screen.findByRole("alert")).toHaveTextContent("We can’t load the video right now.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refreshUrl).toHaveBeenCalledTimes(2);
  });

  test("DC-FR-23: a seek request plays the selected item's moment again", () => {
    const seek = vi.fn();
    vi.spyOn(HTMLMediaElement.prototype, "currentTime", "set").mockImplementation(seek);
    const { rerender } = render(<DraftPlayer {...props} platform="youtube_video" selectedId="it_5" seekKey={0} />);
    seek.mockClear();
    rerender(<DraftPlayer {...props} platform="youtube_video" selectedId="it_5" seekKey={1} />);
    expect(seek).toHaveBeenCalledWith(195);
  });
});
