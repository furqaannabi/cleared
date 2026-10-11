import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";
import { apiBaseUrl } from "@/lib/api";
import { server } from "@/mocks/node";
import { apiError } from "@/test/stub-api";
import { DraftCheckPage } from "./draft-check-page";

// jsdom can't read a video's length; the browser's reading is stood in for.
vi.mock("@/lib/draft/check-draft-file", async (real) => ({ ...(await real<object>()), readVideoLength: async () => 408 }));

const draftRoute = `${apiBaseUrl}/deliverables/del_glow_video/draft`;
const file = (name = "cut3.mp4", size?: number) => {
  const f = new File([new Uint8Array(2048)], name, { type: "video/mp4" });
  if (size) Object.defineProperty(f, "size", { value: size });
  return f;
};
async function open() {
  render(<DraftCheckPage dealId="deal_glow" deliverableId="del_glow_video" />);
  return screen.findByLabelText("Upload new draft");
}

describe("DC-FR-45 (1.18) uploading a draft (design A)", () => {
  test("the upload takes the player's place with its progress and Cancel; the last results fade, labelled", async () => {
    let answer: (r: Response) => void = () => {};
    server.use(http.post(draftRoute, () => new Promise<Response>((r) => (answer = r))));
    await userEvent.upload(await open(), file());
    const up = await screen.findByRole("region", { name: "Uploading your draft" });
    expect(up).toHaveTextContent("cut3.mp4");
    expect(within(up).getByRole("progressbar", { name: "Uploading cut3.mp4" })).toBeInTheDocument();
    expect(within(up).getByRole("button", { name: "Cancel" })).toBeVisible();
    expect(screen.getByText("Your results from run 2, until the new draft is checked:")).toBeVisible();
    answer(HttpResponse.json({ deliverableId: "del_glow_video", state: "checking", run: 3 }) as unknown as Response);
    await waitFor(() => expect(screen.queryByRole("region", { name: "Uploading your draft" })).toBeNull());
  });

  test("Cancel stops it and the page is as it was", async () => {
    server.use(http.post(draftRoute, () => new Promise<Response>(() => {})));
    await userEvent.upload(await open(), file());
    await userEvent.click(within(await screen.findByRole("region", { name: "Uploading your draft" })).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Uploading your draft" })).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("over 1 GB is said before anything is sent", async () => {
    const sent = vi.fn();
    server.use(http.post(draftRoute, () => (sent(), HttpResponse.json({}))));
    await userEvent.upload(await open(), file("master.mov", 3.4 * 1024 ** 3));
    expect(await screen.findByRole("heading", { name: "This file is over 1 GB." })).toBeVisible();
    expect(screen.getByText("master.mov is 3.4 GB. Export a smaller file and upload it again. Nothing was sent.")).toBeVisible();
    expect(sent).not.toHaveBeenCalled();
  });
});

describe("DC-FR-53 (1.18) a limit on drafts", () => {
  test("the post's limit says so, and the upload actions go", async () => {
    server.use(http.post(draftRoute, () => apiError({ code: "draft_limit", field: "post" }, 429)));
    await userEvent.upload(await open(), file());
    expect(await screen.findByRole("alert", { name: "This post has had all the checks one post can have." })).toHaveTextContent(
      "So this draft can’t be checked. Your last results stay as they are.",
    );
    expect(screen.queryByLabelText("Upload new draft")).toBeNull();
  });

  test("the daily limit says when, and uploading stays", async () => {
    server.use(http.post(draftRoute, () => apiError({ code: "draft_limit", field: "overall" }, 429)));
    await userEvent.upload(await open(), file());
    expect(await screen.findByRole("alert", { name: "Cleared has checked all the video it can today." })).toHaveTextContent("You can upload this draft tomorrow.");
    expect(screen.getByLabelText("Upload new draft")).toBeInTheDocument();
  });
});

describe("DC-FR-54 (1.18) a post with no hold yet", () => {
  test("says the brand hasn't approved its hold, and links to the deal's terms", async () => {
    server.use(http.get(`${apiBaseUrl}/deliverables/del_maple_reel`, () => apiError({ code: "not_held" }, 409)));
    render(<DraftCheckPage dealId="deal_maple" deliverableId="del_maple_reel" />);
    expect(await screen.findByRole("heading", { name: "The brand hasn’t approved this post’s hold yet." })).toBeVisible();
    expect(screen.getByText("Its draft check opens once the money is held.")).toBeVisible();
    expect(screen.getByRole("link", { name: "See the deal’s terms" })).toHaveAttribute("href", "/deals/deal_maple/invite");
  });
});
