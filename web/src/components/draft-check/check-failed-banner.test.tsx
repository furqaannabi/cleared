import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { CheckFailedBanner } from "./check-failed-banner";

describe("DC-FR-08, DC-FR-09, DC-FR-28 check-failed banner", () => {
  test("says what happened, that the hold is safe, and which results are shown", () => {
    render(
      <CheckFailedBanner
        banner={{
          kind: "file",
          heading: "We couldn’t check draft_v3.mp4",
          body: "draft_v3.mp4 is 14:20 long, and drafts can be up to 12:00.",
          hold: "Your $1,200.00 hold is still in place",
          showing: "Below are your results from run 2.",
        }}
      />,
    );
    const region = screen.getByRole("region", { name: "We couldn’t check draft_v3.mp4" });
    expect(within(region).getByRole("heading", { level: 2 })).toHaveTextContent("We couldn’t check draft_v3.mp4");
    expect(region).toHaveTextContent("drafts can be up to 12:00");
    expect(within(region).getByText("Your $1,200.00 hold is still in place")).toBeVisible();
    expect(region).toHaveTextContent("Below are your results from run 2.");
    expect(region).toHaveAttribute("data-kind", "file");
  });
});
