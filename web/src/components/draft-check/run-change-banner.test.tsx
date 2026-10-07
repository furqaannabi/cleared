import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import type { RunChange } from "@/lib/deliverable/run-change";
import { RunChangeBanner } from "./run-change-banner";

const worked: RunChange = {
  heading: "Your fix worked",
  tone: "pass",
  lines: ["Code GLOW20 shown on screen now passes."],
  stillNeedsYou: "1 item still needs you.",
  showing: "Below are your results from run 3.",
};

describe("DC-FR-48 run change banner", () => {
  test("names what the fix changed, what still needs the creator, and which run is shown", () => {
    render(<RunChangeBanner change={worked} landed={false} />);
    const banner = screen.getByRole("region", { name: "Your fix worked" });
    expect(banner).toHaveTextContent("Code GLOW20 shown on screen now passes.");
    expect(banner).toHaveTextContent("1 item still needs you.");
    expect(banner).toHaveTextContent("Below are your results from run 3.");
    expect(banner).toHaveAttribute("data-tone", "pass");
  });

  test("a neutral seal when something got worse", () => {
    render(<RunChangeBanner change={{ ...worked, heading: "Your fix worked, but something changed", tone: "neutral" }} landed={false} />);
    expect(screen.getByRole("region", { name: "Your fix worked, but something changed" })).toHaveAttribute("data-tone", "neutral");
  });

  test("its seal stamps in only when the run lands while the creator is watching", () => {
    const { unmount } = render(<RunChangeBanner change={worked} landed={false} />);
    expect(screen.getByTestId("run-change-seal")).not.toHaveAttribute("data-stamp");
    unmount();
    render(<RunChangeBanner change={worked} landed />);
    expect(screen.getByTestId("run-change-seal")).toHaveAttribute("data-stamp", "true");
  });
});
