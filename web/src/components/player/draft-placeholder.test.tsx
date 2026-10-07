import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { DraftPlaceholder } from "./draft-placeholder";

test("DC-FR-02: before a draft, the player's space says so, in the post's shape", () => {
  render(<DraftPlaceholder platform="instagram_reel" />);
  const frame = screen.getByRole("region", { name: "No draft yet" });
  // It is the player's space, not an upload target: the upload action is in the next-step bar.
  expect(frame).toHaveTextContent("Your draft will play here once you upload it.");
  expect(screen.getByTestId("draft-frame")).toHaveAttribute("data-aspect", "9:16");
});
