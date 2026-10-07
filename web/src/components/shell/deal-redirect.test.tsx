import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DealRedirect } from "./deal-redirect";
import { DealsProvider } from "./use-deals";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
beforeEach(() => replace.mockClear());

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
});
