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

test("DC-FR-48, DC-FR-21: when the new run lands, the page says what the fix changed and selects what still needs you", async () => {
  render(<DraftCheckPage dealId="deal_glow" deliverableId="del_glow_video" />);
  const input = await screen.findByLabelText("Upload new draft");
  await userEvent.upload(input, new File(["x"], "draft_v3.mp4", { type: "video/mp4" }));

  const banner = await screen.findByRole("region", { name: "Your fix worked" }, { timeout: 6000 });
  expect(banner).toHaveTextContent("Code GLOW20 shown on screen now passes.");
  expect(banner).toHaveTextContent("1 item still needs you.");
  expect(banner).toHaveTextContent("Below are your results from run 3.");
  expect(screen.getByTestId("run-change-seal")).toHaveAttribute("data-stamp", "true");

  // The serum still needs the creator, so it is selected (its card opens on a phone).
  const checklist = screen.getByRole("region", { name: "Checklist" });
  expect(within(checklist).getByRole("button", { name: /Serum shown in use/ })).toHaveAttribute("aria-expanded", "true");

  // The fixed item shows this run's evidence, not the old failing one.
  await userEvent.click(within(checklist).getByRole("button", { name: /Code GLOW20 shown on screen/ }));
  expect(screen.getByText("Reads “GLOW20”, with a zero.")).toBeVisible();
  expect(screen.queryByText("Reads “GLOW2O”, with a letter O where the zero should be.")).toBeNull();
}, 10_000);

