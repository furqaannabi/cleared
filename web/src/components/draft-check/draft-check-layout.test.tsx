import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { DraftCheckLayout } from "./draft-check-layout";

const slots = {
  player: <p>Player</p>,
  money: <p>Money</p>,
  next: <p>Next step</p>,
  evidence: <p>Evidence</p>,
};

describe("DC-FR-25 page layout", () => {
  test("a landscape draft uses the two-column layout", () => {
    render(<DraftCheckLayout vertical={false} {...slots} />);
    expect(screen.getByTestId("draft-check-layout")).toHaveAttribute("data-layout", "landscape");
  });

  test("a portrait draft (Short or Reel) uses the narrow-player layout", () => {
    render(<DraftCheckLayout vertical {...slots} />);
    expect(screen.getByTestId("draft-check-layout")).toHaveAttribute("data-layout", "portrait");
  });

  test("portrait: reading order is money, player, next step, then evidence (wider screens place them by grid)", () => {
    render(<DraftCheckLayout vertical {...slots} />);
    const order = Array.from(screen.getByTestId("draft-check-layout").querySelectorAll("p")).map((p) => p.textContent);
    expect(order).toEqual(["Money", "Player", "Next step", "Evidence"]);
  });
});
