import { fireEvent, render, screen } from "@testing-library/react";
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

function setScroll(el: HTMLElement, { scrollWidth, clientWidth, scrollLeft }: Record<string, number>) {
  Object.defineProperty(el, "scrollWidth", { configurable: true, value: scrollWidth });
  Object.defineProperty(el, "clientWidth", { configurable: true, value: clientWidth });
  Object.defineProperty(el, "scrollLeft", { configurable: true, value: scrollLeft });
  fireEvent.scroll(el);
}

test("fades its right edge only while more filters are hidden off to the right", () => {
  render(<ChecklistFilter tabs={[...TABS]} value="all" onChange={() => {}} />);
  const group = screen.getByRole("group", { name: "Filter checklist" });

  setScroll(group, { scrollWidth: 420, clientWidth: 340, scrollLeft: 0 });
  expect(group).toHaveAttribute("data-more-right", "true");

  setScroll(group, { scrollWidth: 420, clientWidth: 340, scrollLeft: 80 });
  expect(group).not.toHaveAttribute("data-more-right");

  setScroll(group, { scrollWidth: 300, clientWidth: 340, scrollLeft: 0 });
  expect(group).not.toHaveAttribute("data-more-right");
});
