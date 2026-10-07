import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { PassedBanner } from "./passed-banner";

test("fully passing: the proof earns the seal, one small seal per item", () => {
  render(<PassedBanner passed={{ count: 3, statuses: ["passed", "accepted_by_brand", "passed"] }} brandName="Northbound Coffee" />);
  const banner = screen.getByRole("region", { name: "Every item passed" });
  expect(banner).toHaveTextContent("3 items checked against Northbound Coffee’s brief. Nothing left to fix.");
  expect(within(banner).getAllByTestId("item-seal")).toHaveLength(3);
});
