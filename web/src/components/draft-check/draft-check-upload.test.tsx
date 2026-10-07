import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { DraftCheckPage } from "./draft-check-page";

// This file runs the page as if mocks were on (development or a mock demo).
vi.mock("@/lib/mocking/mocking-enabled", () => ({ MOCKING_ENABLED: true }));

test("DC-FR-45: with mocks on, uploading a new draft shows Checking, then the new run", async () => {
  render(<DraftCheckPage dealId="deal_glow" deliverableId="del_glow_video" />);
  const input = await screen.findByLabelText("Upload new draft");
  await userEvent.upload(input, new File(["x"], "draft_v3.mp4", { type: "video/mp4" }));

  expect(await screen.findByText(/We’re checking your draft against the 6 items/)).toBeVisible();
  expect(await screen.findByText("Fix 1 item, then upload a new draft.", {}, { timeout: 6000 })).toBeVisible();
}, 10_000);
