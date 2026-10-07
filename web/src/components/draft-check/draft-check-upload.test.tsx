import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { DraftCheckPage } from "./draft-check-page";

// This file runs the page as if mocks were on (development or a mock demo).
vi.mock("@/lib/mocking/mocking-enabled", () => ({ MOCKING_ENABLED: true }));

test("DC-FR-45: with mocks on, uploading a new draft shows Checking, then the new run", async () => {
  render(<DraftCheckPage dealId="deal_glow" deliverableId="del_glow_video" />);
  const input = await screen.findByLabelText("Upload new draft");
  await userEvent.upload(input, new File(["x"], "draft_v3.mp4", { type: "video/mp4" }));

  expect(await within(screen.getByRole("region", { name: "What to do next" })).findByText(/We’re checking your draft against the 6 items/)).toBeVisible();
  expect(screen.getByRole("region", { name: "Checking your draft" })).toHaveTextContent("Watching the videoNow");
  expect(
    await within(screen.getByRole("region", { name: "What to do next" })).findByText("Decide on 1 unsure item.", {}, { timeout: 6000 }),
  ).toBeVisible();
}, 10_000);

test("DC-BR-10: on mocks, the page says its data is synthetic", async () => {
  render(<DraftCheckPage dealId="deal_glow" deliverableId="del_glow_video" />);
  expect(await screen.findByText(/Demo data\. Glow Theory, Northbound Coffee, Kora Audio and Ada Okafor are made up/)).toBeVisible();
});
