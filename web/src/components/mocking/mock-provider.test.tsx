import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { MockProvider } from "./mock-provider";

const start = vi.fn(() => Promise.resolve());
vi.mock("@/mocks/browser", () => ({ worker: { start } }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  start.mockClear();
});

// docs/decisions/2026-10-06-frontend-mocks-msw.md: outside development the app renders untouched.
test("renders its children straight away when mocking is off", () => {
  render(
    <MockProvider>
      <p>App content</p>
    </MockProvider>,
  );
  expect(screen.getByText("App content")).toBeInTheDocument();
});

test("in development with mocking enabled, starts the worker before rendering", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_API_MOCKING", "enabled");
  const { MockProvider: DevProvider } = await import("./mock-provider");

  render(
    <DevProvider>
      <p>App content</p>
    </DevProvider>,
  );

  expect(screen.queryByText("App content")).not.toBeInTheDocument();
  expect(await screen.findByText("App content")).toBeInTheDocument();
  expect(start).toHaveBeenCalledWith({ onUnhandledFrame: "bypass" });
});

test("never starts the worker in a production build", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_API_MOCKING", "enabled");
  const { MockProvider: ProdProvider } = await import("./mock-provider");

  render(
    <ProdProvider>
      <p>App content</p>
    </ProdProvider>,
  );

  expect(screen.getByText("App content")).toBeInTheDocument();
  expect(start).not.toHaveBeenCalled();
});
