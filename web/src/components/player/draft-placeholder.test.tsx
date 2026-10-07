import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { DraftPlaceholder } from "./draft-placeholder";

test("DC-FR-02: before a draft, the player's space says so, in the post's shape", () => {
  render(<DraftPlaceholder platform="instagram_reel" />);
  const frame = screen.getByRole("region", { name: "No draft yet" });
  expect(frame).toHaveTextContent("Upload the video file to check it against the checklist.");
  expect(screen.getByTestId("draft-frame")).toHaveAttribute("data-aspect", "9:16");
});
