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

  test("DC-FR-27: puts the money for this deliverable on the page", async () => {
    render(<DraftCheckPage deliverableId="del_glow_video" />);
    const money = await screen.findByRole("region", { name: "Payment for this deliverable" });
    expect(money).toHaveTextContent("$1,200.00");
  });

  test("DC-FR-12, DC-FR-21: lists the checklist with the first item to fix open", async () => {
    render(<DraftCheckPage deliverableId="del_glow_video" />);
    const checklist = await screen.findByRole("region", { name: "Checklist" });
    expect(checklist).toHaveTextContent("9 items");
    expect(screen.getByRole("button", { name: /Code GLOW20 shown on screen/ })).toHaveAttribute("aria-expanded", "true");
  });

  test("DC-FR-20: a filter narrows the checklist", async () => {
    render(<DraftCheckPage deliverableId="del_glow_video" />);
    await userEvent.click(await screen.findByRole("button", { name: "Needs you 2" }));
    const checklist = screen.getByRole("region", { name: "Checklist" });
    const names = Array.from(checklist.querySelectorAll("li b")).map((b) => b.textContent);
    expect(names).toEqual(["Code GLOW20 shown on screen", "Serum shown in use"]);
  });
});
