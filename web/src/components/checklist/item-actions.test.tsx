import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { ItemView } from "@/lib/deliverable/deliverable-view";
import { hasItemActions, ItemActions } from "./item-actions";

const base: ItemView = {
  id: "it_6",
  name: "Serum shown in use",
  kind: "shown",
  status: "unsure",
  briefLine: { number: 6, text: "Show the serum on skin." },
  checkedBy: "ai_timestamp",
  change: null,
  action: null,
  asked: null,
};
const renderActions = (item: Partial<ItemView>, props: Partial<Parameters<typeof ItemActions>[0]> = {}) =>
  render(
    <ItemActions item={{ ...base, ...item }} brandName="Glow Theory" onAsk={() => {}} onWithdraw={() => {}} pending={false} problem={null} {...props} />,
  );

describe("DC-FR-14 to DC-FR-18 item actions", () => {
  test("DC-FR-14: Ask says what the brand will see, and asks when pressed", async () => {
    const onAsk = vi.fn();
    renderActions({ action: "ask" }, { onAsk });
    expect(screen.getByText("Glow Theory sees this moment and its evidence. You can still upload a fix.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Ask Glow Theory to accept" }));
    expect(onAsk).toHaveBeenCalledOnce();
  });

  test("DC-FR-15, DC-FR-18: Withdraw says when it was asked and that it never clears on a timer", async () => {
    const onWithdraw = vi.fn();
    renderActions({ status: "waiting_for_brand", action: "withdraw", asked: "2 hours ago" }, { onWithdraw });
    expect(screen.getByText("You asked 2 hours ago. It stays here until Glow Theory answers; it never clears on a timer.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(onWithdraw).toHaveBeenCalledOnce();
  });

  test("DC-FR-17: a declined item shows the brand's note, as plain text", () => {
    renderActions({ declined: true, brandNote: "<b>Show it on skin.</b>" });
    expect(screen.getByText("Glow Theory asked you to fix this")).toBeVisible();
    expect(screen.getByText("“<b>Show it on skin.</b>”")).toBeVisible();
  });

  test("DC-FR-16: an accepted item says the brand accepted it", () => {
    renderActions({ status: "accepted_by_brand" });
    expect(screen.getByText("Glow Theory accepted this moment. It counts as passed for this draft.")).toBeVisible();
  });

  test("while sending, the button can't be pressed twice; a problem is said plainly", () => {
    renderActions({ action: "ask" }, { pending: true, problem: "We couldn’t send that. Try again." });
    expect(screen.getByRole("button", { name: "Ask Glow Theory to accept" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn’t send that. Try again.");
  });

  test("shows nothing for an item with no action and nothing to say", () => {
    const { container } = renderActions({ status: "passed" });
    expect(container).toBeEmptyDOMElement();
  });

  test("hasItemActions says whether there is anything to show", () => {
    expect(hasItemActions({ ...base, status: "passed" })).toBe(false);
    expect(hasItemActions({ ...base, action: "ask" })).toBe(true);
    expect(hasItemActions({ ...base, declined: true })).toBe(true);
    expect(hasItemActions({ ...base, status: "accepted_by_brand" })).toBe(true);
  });
});
