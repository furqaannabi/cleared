import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { apiBaseUrl } from "@/lib/api";
import { server } from "@/test/server";
import { aDealDraft, recordRequests } from "@/test/stub-api";
import { NewDealForm } from "./new-deal-form";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
beforeEach(() => push.mockClear());

describe("BC-FR-02, BC-FR-03 new deal", () => {
  test("names the brand and its posts, then opens the new deal's checklist", async () => {
    server.use(http.post(`${apiBaseUrl}/deals`, () => HttpResponse.json(aDealDraft())));
    const sent = recordRequests();
    render(<NewDealForm />);
    await userEvent.type(screen.getByLabelText("Brand"), "Glow Theory");
    expect(screen.getByLabelText("Post 1")).toHaveValue("youtube_video");
    await userEvent.click(screen.getByRole("button", { name: "Add another post" }));
    await userEvent.selectOptions(screen.getByLabelText("Post 2"), "instagram_reel");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/deals/deal_new/checklist"));
    expect(sent).toContainEqual({
      method: "POST",
      path: "/deals",
      body: { brandName: "Glow Theory", deliverables: [{ platform: "youtube_video" }, { platform: "instagram_reel" }] },
    });
  });

  test("asks for the brand's name before continuing", async () => {
    render(<NewDealForm />);
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Add the brand’s name.")).toBeVisible();
    expect(screen.getByLabelText("Brand")).toHaveAttribute("aria-invalid", "true");
    expect(push).not.toHaveBeenCalled();
  });

  test("a post can be removed while there is more than one", async () => {
    render(<NewDealForm />);
    expect(screen.queryByRole("button", { name: "Remove post 1" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Add another post" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove post 2" }));
    expect(screen.queryByLabelText("Post 2")).toBeNull();
  });
});
