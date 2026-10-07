import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { glowTheoryVideo } from "@/mocks/fixtures/deliverables";
import { deliverableView } from "@/lib/deliverable/deliverable-view";
import ChecklistGrid from "./checklist-grid";

const view = deliverableView(glowTheoryVideo, new Date("2026-10-06T12:00:00Z"));

describe("DC-FR-40 checklist grid", () => {
  test("shows a row per item with its name, evidence, kind, time, brief line and result", async () => {
    render(<ChecklistGrid items={view.items} brandName="Glow Theory" selectedId={null} onSelect={() => {}} wide />);
    const rows = await screen.findAllByRole("row", { name: /GLOW20 shown on screen/ });
    const row = rows[0];
    expect(within(row).getByText("Code GLOW20 shown on screen")).toBeInTheDocument();
    expect(within(row).getByText("Reads “GLOW2O”, with a letter O where the zero should be.")).toBeInTheDocument();
    expect(within(row).getByText("Shown as text")).toBeInTheDocument();
    expect(within(row).getByText("3:15")).toBeInTheDocument();
    expect(within(row).getByText("Line 5")).toBeInTheDocument();
    expect(within(row).getByText("Fix needed")).toBeInTheDocument();
  });

  test("DC-FR-22: clicking a row selects that item, and the selected item's row is marked", async () => {
    const onSelect = vi.fn();
    render(<ChecklistGrid items={view.items} brandName="Glow Theory" selectedId="it_5" onSelect={onSelect} wide />);
    await waitFor(() =>
      expect(screen.getAllByRole("row", { name: /GLOW20 shown on screen/ })[0]).toHaveAttribute("aria-selected", "true"),
    );

    const [serumRow] = screen.getAllByRole("row", { name: /Serum shown in use/ });
    await userEvent.click(within(serumRow).getByText("Serum shown in use"));
    expect(onSelect).toHaveBeenCalledWith("it_6");
  });

  test("sorting by Result puts items that need the creator first", async () => {
    render(<ChecklistGrid items={view.items} brandName="Glow Theory" selectedId={null} onSelect={() => {}} wide />);
    await userEvent.click(await screen.findByText("Result"));
    // AG Grid positions rows with transforms, so read the accessible order (aria-rowindex), not DOM order.
    const names = () =>
      screen
        .getAllByRole("row")
        .filter((r) => r.querySelector("b"))
        .sort((x, y) => Number(x.getAttribute("aria-rowindex")) - Number(y.getAttribute("aria-rowindex")))
        .map((r) => r.querySelector("b")?.textContent);
    await waitFor(() => expect(names().slice(0, 2)).toEqual(["Code GLOW20 shown on screen", "Serum shown in use"]));
  });

  test("a failed item's row keeps its fail colour, even when selected", async () => {
    render(<ChecklistGrid items={view.items} brandName="Glow Theory" selectedId="it_5" onSelect={() => {}} wide />);
    await waitFor(() => expect(screen.getAllByRole("row", { name: /GLOW20 shown on screen/ })[0]).toHaveClass("row-fail"));
    expect(screen.getAllByRole("row", { name: /Serum shown in use/ })[0]).not.toHaveClass("row-fail");
  });

  test("the seal column is named Status, so no column header is blank", async () => {
    render(<ChecklistGrid items={view.items} brandName="Glow Theory" selectedId={null} onSelect={() => {}} wide />);
    expect(await screen.findByRole("columnheader", { name: "Status" })).toBeInTheDocument();
  });

  test("DC-FR-22: Enter or Space on a focused row selects its item", async () => {
    const onSelect = vi.fn();
    render(<ChecklistGrid items={view.items} brandName="Glow Theory" selectedId={null} onSelect={onSelect} wide />);
    const [serumRow] = await screen.findAllByRole("row", { name: /Serum shown in use/ });
    const cell = within(serumRow).getAllByRole("gridcell")[1];
    fireEvent.focus(cell);
    fireEvent.keyDown(cell, { key: "Enter" });
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("it_6"));
    onSelect.mockClear();
    fireEvent.keyDown(cell, { key: " " });
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("it_6"));
  });

  test("DC-FR-46: the grid never shows a suggested fix; the evidence panel beside it does", async () => {
    const hint = "Change the on-screen code to GLOW20, with a zero.";
    const items = view.items.map((i) => ({ ...i, suggestedFix: hint }));
    render(<ChecklistGrid items={items} brandName="Glow Theory" selectedId={null} onSelect={() => {}} wide />);
    await screen.findAllByRole("row", { name: /Serum shown in use/ });
    expect(screen.queryByText(hint)).toBeNull();
  });

  test("DC-FR-12: only items checked after publishing say After publish; an item not timed yet says so", async () => {
    const base = view.items.find((i) => i.id === "it_5")!;
    const items = [
      { ...base, id: "x1", name: "Names the Kora Pods early", status: "not_checked" as const, evidence: undefined },
      { ...base, id: "x2", name: "Link in the description", status: "at_live_check" as const, evidence: undefined },
    ];
    render(<ChecklistGrid items={items} brandName="Kora Audio" selectedId={null} onSelect={() => {}} wide />);
    const [early] = await screen.findAllByRole("row", { name: /Names the Kora Pods early/ });
    expect(within(early).queryByText("After publish")).toBeNull();
    expect(within(early).getByText("No time yet")).toBeInTheDocument();
    const [link] = screen.getAllByRole("row", { name: /Link in the description/ });
    expect(within(link).getByText("After publish")).toBeInTheDocument();
  });
});

