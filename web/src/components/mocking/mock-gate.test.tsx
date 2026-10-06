import { render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { expect, test, vi } from "vitest";
import MockGate from "./mock-gate";

const { start } = vi.hoisted(() => ({ start: vi.fn(() => Promise.resolve()) }));
vi.mock("@/mocks/browser", () => ({ worker: { start } }));

// Regression: React runs effects twice in development, and MSW throws
// "cannot configure an already enabled network" if started twice.
test("starts the worker once even when React runs the effect twice", async () => {
  render(
    <StrictMode>
      <MockGate>
        <p>App content</p>
      </MockGate>
    </StrictMode>,
  );
  expect(await screen.findByText("App content")).toBeInTheDocument();
  expect(start).toHaveBeenCalledTimes(1);
});
