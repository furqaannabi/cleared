import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { NextStepBar } from "./next-step-bar";

describe("DC-FR-30 next-step bar", () => {
  test("says what happens next in a lead and a detail", () => {
    render(<NextStepBar step={{ lead: "Fix 2 items, then upload a new draft.", detail: "Review starts once every item passes.", action: "upload_new_draft" }} onTryAgain={() => {}} />);
    const bar = screen.getByRole("region", { name: "What to do next" });
    expect(bar).toHaveTextContent("Fix 2 items, then upload a new draft.");
    expect(bar).toHaveTextContent("Review starts once every item passes.");
  });

  test("DC-FR-09: Try again is a full-width button that retries the check", async () => {
    const onTryAgain = vi.fn();
    render(<NextStepBar step={{ lead: "Something went wrong on our side.", detail: "It isn’t your video.", action: "try_again" }} onTryAgain={onTryAgain} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onTryAgain).toHaveBeenCalledOnce();
  });

  test("an upload action shows no button until the upload flow exists", () => {
    render(<NextStepBar step={{ lead: "Upload your draft.", detail: "", action: "upload_draft" }} onTryAgain={() => {}} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
