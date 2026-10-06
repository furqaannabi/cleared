import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ITEM_STATUSES } from "@/lib/checklist/item-status";
import { StatusChip } from "./status-chip";

const BRAND = "Glow Theory";

describe("DC-FR-13 StatusChip", () => {
  test("shows the status word with an icon beside it", () => {
    render(<StatusChip status="fix_needed" brandName={BRAND} />);
    const chip = screen.getByText("Fix needed");
    expect(chip.closest("[data-status]")?.querySelector("svg")).not.toBeNull();
  });

  test("every status renders as an icon plus a word", () => {
    for (const status of ITEM_STATUSES) {
      const { container, unmount } = render(<StatusChip status={status} brandName={BRAND} />);
      const chip = container.querySelector(`[data-status="${status}"]`);
      expect(chip?.textContent?.trim(), status).not.toBe("");
      expect(chip?.querySelector("svg"), status).not.toBeNull();
      unmount();
    }
  });

  test("only a Passed chip is green; Accepted by the brand is not", () => {
    render(<StatusChip status="passed" brandName={BRAND} />);
    render(<StatusChip status="accepted_by_brand" brandName={BRAND} />);
    expect(screen.getByText("Passed")).toHaveClass("text-pass");
    expect(screen.getByText("Accepted by Glow Theory")).not.toHaveClass("text-pass");
  });
});
