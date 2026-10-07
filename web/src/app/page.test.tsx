import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "./page";

test("LP-FR-02: the root route is the landing page", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Brand deals where the content and the payment clear together.");
});
