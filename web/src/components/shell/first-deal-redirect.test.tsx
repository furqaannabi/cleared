import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { apiBaseUrl } from "@/lib/api";
import { server } from "@/mocks/node";
import { FirstDealRedirect } from "./first-deal-redirect";
import { DealsProvider } from "./use-deals";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
beforeEach(() => replace.mockClear());

const page = () =>
  render(
    <DealsProvider>
      <FirstDealRedirect />
    </DealsProvider>,
  );

describe("LP-FR-15 /deals", () => {
  test("opens the creator's first deal at the deliverable that needs them", async () => {
    page();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/deals/deal_glow/deliverables/del_glow_video"));
  });

  test("with no deals, says so plainly", async () => {
    server.use(http.get(`${apiBaseUrl}/deals`, () => HttpResponse.json([])));
    page();
    expect(await screen.findByText("You have no deals yet.")).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });

  test("if the deals can't be loaded, offers Try again", async () => {
    server.use(http.get(`${apiBaseUrl}/deals`, () => HttpResponse.json({}, { status: 500 })));
    page();
    expect(await screen.findByRole("button", { name: "Try again" })).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });
});
