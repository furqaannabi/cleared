import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { glowTheoryVideo } from "@/mocks/fixtures/deliverables";
import { BriefSheet } from "./brief-sheet";

const brief = glowTheoryVideo.brief!;

describe("DC-FR-30 View brief", () => {
  test("opens the brief read-only, every line numbered, the selected item's line marked", async () => {
    render(<BriefSheet brief={brief} brandName="Glow Theory" highlightLine={5} />);
    await userEvent.click(screen.getByRole("button", { name: "View brief" }));
    const dialog = screen.getByRole("dialog", { name: "Glow Theory’s brief" });
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(9);
    const marked = within(dialog).getByText("Say and show the code GLOW20.").closest("li");
    expect(marked).toHaveAttribute("aria-current", "true");
    expect(within(dialog).getByText("Mention Glow Theory within the first minute.").closest("li")).not.toHaveAttribute("aria-current");
  });

  test("closing returns focus to View brief", async () => {
    render(<BriefSheet brief={brief} brandName="Glow Theory" highlightLine={null} />);
    const open = screen.getByRole("button", { name: "View brief" });
    await userEvent.click(open);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(open).toHaveFocus();
  });
});
