import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { apiBaseUrl } from "@/lib/api";
import { server } from "@/mocks/node";
import { DraftCheckPage } from "./draft-check-page";

describe("creator draft check page", () => {
  test("DC-FR-39: shows the page's shape while loading, announced to screen readers", () => {
    render(<DraftCheckPage deliverableId="del_glow_video" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading this deliverable");
  });

  test("DC-FR-32, DC-FR-30: shows the deliverable's title and what happens next", async () => {
    render(<DraftCheckPage deliverableId="del_glow_video" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Glow Theory · YouTube video" })).toBeVisible();
    expect(screen.getByText("Fix 2 items, then upload a new draft.")).toBeVisible();
  });

  test("DC-FR-38: an unknown or not-yours deliverable shows the same plain page", async () => {
    render(<DraftCheckPage deliverableId="del_nope" />);
    expect(await screen.findByRole("heading", { level: 1, name: "We couldn’t find this deal" })).toBeVisible();
  });

  test("DC-FR-39: a failed load says so plainly and Try again loads it again", async () => {
    server.use(
      http.get(`${apiBaseUrl}/deliverables/:id`, () => HttpResponse.json({}, { status: 500 }), { once: true }),
    );
    render(<DraftCheckPage deliverableId="del_glow_video" />);
    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(screen.getByText("We couldn’t load this deliverable.")).toBeVisible();

    await userEvent.click(retry);
    expect(await screen.findByRole("heading", { level: 1, name: "Glow Theory · YouTube video" })).toBeVisible();
  });
});
