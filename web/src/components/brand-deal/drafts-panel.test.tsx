import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { api } from "@/lib/api";
import { BrandDealPage } from "./brand-deal-page";

describe("RW-FR-01, RW-FR-02 each post's draft on the brand's deal page", () => {
  test("lists each held post's draft, what needs the brand first, each linking to its review", async () => {
    await api.openBrandLink("demo_juniper");
    render(<BrandDealPage dealId="deal_juniper" />);
    const drafts = await screen.findByRole("region", { name: "Drafts" });
    const rows = within(drafts).getAllByRole("group");
    expect(rows.map((r) => r.getAttribute("aria-label"))).toEqual(["YouTube video", "Instagram Reel", "YouTube Short"]);
    expect(rows[0]).toHaveTextContent(/Draft ready for your review · 31h 1[12]m left/);
    expect(within(rows[0]).getByRole("link", { name: "Review draft" })).toHaveAttribute("href", "/brand/deals/deal_juniper/deliverables/del_juniper_video");
    expect(rows[1]).toHaveTextContent("Ada Okafor asked you about 1 item");
    expect(rows[2]).toHaveTextContent(/^.*Approved · Ada Okafor posts by/);
    expect(within(rows[2]).queryByRole("link")).toBeNull();
    expect(screen.getByText("Each post’s draft comes here for your review. Each has its own hold and its own 48 hours.")).toBeVisible();
  });

  test("before any draft check exists there is no Drafts panel", async () => {
    await api.openBrandLink("demo_maple");
    render(<BrandDealPage dealId="deal_maple" />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("region", { name: "Drafts" })).toBeNull();
  });
});
