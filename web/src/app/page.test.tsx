import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "./page";

// Tooling check: proves Vitest, React Testing Library and jest-dom are wired.
test("root page shows the wordmark and tagline", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { level: 1, name: "Cleared" })).toBeInTheDocument();
  expect(screen.getByText("Brand deals where the content and the payment clear together.")).toBeVisible();
});
