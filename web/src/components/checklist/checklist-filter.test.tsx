import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ChecklistFilter } from "./checklist-filter";

const TABS = [
  { id: "all", label: "All", count: 9 },
  { id: "needs_you", label: "Needs you", count: 2 },
  { id: "passed", label: "Passed", count: 4 },
  { id: "at_live_check", label: "At live check", count: 3 },
] as const;

test("DC-FR-20: each filter shows its count, with the chosen one pressed", async () => {
  const onChange = vi.fn();
  render(<ChecklistFilter tabs={[...TABS]} value="all" onChange={onChange} />);
  const group = screen.getByRole("group", { name: "Filter checklist" });
  expect(group).toBeVisible();
  expect(screen.getByRole("button", { name: "All 9" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Needs you 2" })).toHaveAttribute("aria-pressed", "false");

  await userEvent.click(screen.getByRole("button", { name: "Needs you 2" }));
  expect(onChange).toHaveBeenCalledWith("needs_you");
});
