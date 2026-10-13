import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { apiBaseUrl } from "@/lib/api";
import { seededPosts, stubPosts } from "@/test/creator-posts";
import { server } from "@/test/server";
import { DraftCheckPage } from "./draft-check-page";

// jsdom can't read a video's length; the browser's reading is stood in for.
vi.mock("@/lib/draft/check-draft-file", async (real) => ({ ...(await real<object>()), readVideoLength: async () => 408 }));

const draftRoute = `${apiBaseUrl}/deliverables/del_glow_video/draft`;
const video = (name = "cut3.mp4") => new File([new Uint8Array(2048)], name, { type: "video/mp4" });
/** A drag carrying files, as the browser's DataTransfer reads to the page. */
const carrying = (...files: File[]) => ({ dataTransfer: { types: ["Files"], files, items: files.map(() => ({ kind: "file" })) } });
const desktop = () =>
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(min-width: 768px)", media: query, addEventListener: () => {}, removeEventListener: () => {} }));

beforeEach(() => void stubPosts(...seededPosts()));
afterEach(() => vi.unstubAllGlobals());

describe("DC-FR-56 (1.28) dragging a draft onto the page", () => {
  test("on desktop, dragging a video shows where it goes, and dropping it anywhere uploads it", async () => {
    desktop();
    const sent = vi.fn();
    server.use(http.post(draftRoute, () => (sent(), new Promise<Response>(() => {}))));
    render(<DraftCheckPage dealId="deal_glow" deliverableId="del_glow_video" />);
    await screen.findByLabelText("Upload new draft");

    fireEvent.dragEnter(document.body, carrying(video()));
    expect(screen.getByText("Drop to upload your new draft")).toBeVisible();
    const drop = fireEvent.drop(document.body, carrying(video()));
    expect(drop).toBe(false);
    expect(await screen.findByRole("region", { name: "Uploading your draft" })).toHaveTextContent("cut3.mp4");
    expect(screen.queryByText("Drop to upload your new draft")).toBeNull();
    await waitFor(() => expect(sent).toHaveBeenCalledTimes(1));
  });

  test("several files dropped: none is sent, and the page says to drop one", async () => {
    desktop();
    const sent = vi.fn();
    server.use(http.post(draftRoute, () => (sent(), HttpResponse.json({}))));
    render(<DraftCheckPage dealId="deal_glow" deliverableId="del_glow_video" />);
    await screen.findByLabelText("Upload new draft");
    fireEvent.dragEnter(document.body, carrying(video(), video("b.mp4"), video("c.mp4")));
    fireEvent.drop(document.body, carrying(video(), video("b.mp4"), video("c.mp4")));
    expect(await screen.findByRole("heading", { name: "Drop one video at a time." })).toBeVisible();
    expect(screen.getByText("You dropped 3 files. Nothing was sent.")).toBeVisible();
    expect(sent).not.toHaveBeenCalled();
  });

  test("while no upload is offered (in review), dragging says so, and a drop does nothing and never opens the file", async () => {
    desktop();
    const sent = vi.fn();
    server.use(http.post(`${apiBaseUrl}/deliverables/del_nb_short/draft`, () => (sent(), HttpResponse.json({}))));
    render(<DraftCheckPage dealId="deal_nb" deliverableId="del_nb_short" />);
    await screen.findByRole("region", { name: "What to do next" });
    fireEvent.dragEnter(document.body, carrying(video()));
    expect(screen.getByText("You can’t upload a draft right now.")).toBeVisible();
    expect(fireEvent.drop(document.body, carrying(video()))).toBe(false);
    expect(screen.queryByText("You can’t upload a draft right now.")).toBeNull();
    expect(screen.queryByRole("region", { name: "Uploading your draft" })).toBeNull();
    expect(sent).not.toHaveBeenCalled();
  });

  test("a drag leaving the window takes the target away", async () => {
    desktop();
    render(<DraftCheckPage dealId="deal_glow" deliverableId="del_glow_video" />);
    await screen.findByLabelText("Upload new draft");
    fireEvent.dragEnter(document.body, carrying(video()));
    fireEvent.dragLeave(document.body, carrying(video()));
    expect(screen.queryByText("Drop to upload your new draft")).toBeNull();
  });

  test("phones are unchanged: no drop target", async () => {
    render(<DraftCheckPage dealId="deal_glow" deliverableId="del_glow_video" />);
    await screen.findByLabelText("Upload new draft");
    fireEvent.dragEnter(document.body, carrying(video()));
    expect(screen.queryByText("Drop to upload your new draft")).toBeNull();
  });

  test("DC-FR-02: with no draft yet, the panel says the video can be dragged there", async () => {
    desktop();
    render(<DraftCheckPage dealId="deal_kora" deliverableId="del_kora_reel" />);
    const empty = await screen.findByRole("region", { name: "No draft yet" });
    expect(empty).toHaveTextContent("Drag your video here, or use Upload draft.");
    fireEvent.dragEnter(document.body, carrying(video()));
    expect(screen.getByText("Drop to upload your draft")).toBeVisible();
  });
});
