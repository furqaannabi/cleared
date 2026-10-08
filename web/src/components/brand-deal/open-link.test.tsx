import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { apiBaseUrl } from "@/lib/api";
import { server } from "@/mocks/node";
import { describe, expect, test, vi } from "vitest";
import { OpenLink } from "./open-link";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

describe("CH-FR-01 opening the link", () => {
  test("says it's opening, then replaces the URL with the deal's, so the token leaves the address bar", async () => {
    render(<OpenLink token="demo_maple" />);
    expect(screen.getByText("Opening your deal…")).toBeVisible();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/brand/deals/deal_maple"));
  });
});

describe("CH-FR-02 a link that doesn't work", () => {
  test("shows one message that names no one and gives no reason", async () => {
    render(<OpenLink token="nope" />);
    expect(await screen.findByRole("heading", { name: "This link doesn’t work any more" })).toBeVisible();
    expect(screen.getByText("Ask the creator who sent it for a new one.")).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });
});

test("when Cleared can't be reached, it says so and offers to try again, without calling the link dead", async () => {
  server.use(http.post(`${apiBaseUrl}/b/:token/session`, () => HttpResponse.error(), { once: true }));
  render(<OpenLink token="demo_maple" />);
  expect(await screen.findByText("We couldn’t reach Cleared. Check your connection and try again.")).toBeVisible();
  expect(screen.queryByText("This link doesn’t work any more")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/brand/deals/deal_maple"));
});
