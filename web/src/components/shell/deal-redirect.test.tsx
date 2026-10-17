import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { apiBaseUrl } from "@/lib/api";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { deals } from "@/test/fixtures/deals";
import { server } from "@/test/server";
import { stubDeals } from "@/test/stub-api";
import { DealRedirect } from "./deal-redirect";
import { DealsProvider } from "./use-deals";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
beforeEach(() => {
  replace.mockClear();
  stubDeals(deals);
});

describe("DC-FR-37 opening a deal", () => {
  test("opens the deliverable the API says needs the creator", async () => {
    render(
      <DealsProvider>
        <DealRedirect dealId="deal_nb" />
      </DealsProvider>,
    );
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/deals/deal_nb/deliverables/del_nb_short"));
  });

  test("DC-FR-38: an unknown deal shows the same plain not-found page", async () => {
    render(
      <DealsProvider>
        <DealRedirect dealId="deal_nope" />
      </DealsProvider>,
    );
    expect(await screen.findByRole("heading", { name: "We couldn’t find this deal" })).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });

  test("BC-FR-03: a deal still at the checklist step opens its checklist", async () => {
    server.use(http.get(`${apiBaseUrl}/deals`, () => HttpResponse.json([{ id: "deal_new", brandName: "Glow Theory", status: "Checklist", step: "checklist", deliverables: [] }])));
    render(
      <DealsProvider>
        <DealRedirect dealId="deal_new" />
      </DealsProvider>,
    );
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/deals/deal_new/checklist"));
  });

  test("1.30: a cancelled deal opens the post the API names", async () => {
    server.use(
      http.get(`${apiBaseUrl}/deals`, () =>
        HttpResponse.json([{ id: "deal_off", brandName: "Flintduo", status: "Cancelled", openDeliverableId: "del_off", deliverables: [{ id: "del_off", platform: "youtube_video", state: "released", needsCreator: false, closedBecause: "cancelled" }] }]),
      ),
    );
    render(
      <DealsProvider>
        <DealRedirect dealId="deal_off" />
      </DealsProvider>,
    );
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/deals/deal_off/deliverables/del_off"));
  });

  test("DC-FR-57: a deal with nothing to open says so, with a way back to Deals, and never stays loading", async () => {
    server.use(http.get(`${apiBaseUrl}/deals`, () => HttpResponse.json([{ id: "deal_none", brandName: "Flintduo", status: "Cancelled", deliverables: [] }])));
    render(
      <DealsProvider>
        <DealRedirect dealId="deal_none" />
      </DealsProvider>,
    );
    expect(await screen.findByRole("heading", { name: "This deal has nothing to open." })).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to Deals" })).toHaveAttribute("href", "/deals");
    expect(replace).not.toHaveBeenCalled();
  });
});
