import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, test, vi } from "vitest";
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
    expect(within(checklist).getByRole("button", { name: /Code GLOW20 shown on screen/ })).toHaveAttribute("aria-expanded", "true");
  });

  test("DC-FR-20: a filter narrows the checklist", async () => {
    render(<DraftCheckPage deliverableId="del_glow_video" />);
    await userEvent.click(await screen.findByRole("button", { name: "Needs you 2" }));
    const checklist = screen.getByRole("region", { name: "Checklist" });
    const names = Array.from(checklist.querySelectorAll("li b")).map((b) => b.textContent);
    expect(names).toEqual(["Code GLOW20 shown on screen", "Serum shown in use"]);
  });

  describe("on tablet and up", () => {
    afterEach(() => vi.unstubAllGlobals());

    test("DC-FR-22: the evidence panel shows the selected item, and follows a row click", async () => {
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: query === "(min-width: 768px)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));
      render(<DraftCheckPage deliverableId="del_glow_video" />);
      expect(await screen.findByRole("region", { name: "Evidence for Code GLOW20 shown on screen" })).toBeVisible();

      const [serumRow] = await screen.findAllByRole("row", { name: /Serum shown in use/ });
      await userEvent.click(within(serumRow).getByText("Serum shown in use"));
      expect(await screen.findByRole("region", { name: "Evidence for Serum shown in use" })).toBeVisible();
    });
  });

  test("DC-FR-14, DC-FR-15 on a phone: ask the brand from the card, then withdraw", async () => {
    render(<DraftCheckPage deliverableId="del_glow_video" />);
    const checklist = await screen.findByRole("region", { name: "Checklist" });
    await userEvent.click(within(checklist).getByRole("button", { name: /Serum shown in use/ }));
    await userEvent.click(screen.getByRole("button", { name: "Ask Glow Theory to accept" }));

    const serum = within(checklist).getByRole("button", { name: /Serum shown in use/ });
    expect(await within(serum).findByText("Waiting for Glow Theory")).toBeVisible();
    expect(screen.getByText(/You asked just now/)).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(await within(serum).findByText("Unsure")).toBeVisible();
    expect(screen.getByRole("button", { name: "Ask Glow Theory to accept" })).toBeVisible();
  });

  test("DC-FR-23: shows the draft video with its timeline", async () => {
    render(<DraftCheckPage deliverableId="del_glow_video" />);
    expect(await screen.findByLabelText("Draft video draft_v2.mp4")).toHaveAttribute(
      "src",
      "/mock-media/synthetic-draft-16x9.mp4",
    );
    expect(screen.getByRole("button", { name: "Code GLOW20 shown on screen, Fix needed, at 3:15" })).toBeVisible();
  });

  test("DC-FR-09: after a check failed on our side, Try again restarts it", async () => {
    render(<DraftCheckPage deliverableId="del_glow_failed_ours" />);
    expect(await screen.findByText("Something went wrong on our side checking draft_v3.mp4.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/We’re checking your draft against the 6 items/)).toBeVisible();
  });

  test("DC-FR-09: if the retry itself fails, the bar says so", async () => {
    server.use(http.post(`${apiBaseUrl}/deliverables/:id/check/retry`, () => HttpResponse.json({}, { status: 500 })));
    render(<DraftCheckPage deliverableId="del_glow_failed_ours" />);
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn’t restart the check. Try again in a moment.");
  });
});
