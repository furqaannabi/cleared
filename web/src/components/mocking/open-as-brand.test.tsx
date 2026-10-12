import { render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { InvitePage } from "@/components/invite/invite-page";
import { aProfile, anInvite, stubDeals, stubInvite, stubSession } from "@/test/stub-api";
import { DemoBuildProvider } from "./demo-build";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

/* The mock build's way to open the brand's side, which Playwright uses until the live suite. */

const withLink = () => {
  stubSession(aProfile({ paypalEmail: "ada@example.com" }));
  stubDeals([]);
  stubInvite(
    anInvite({
      dealId: "deal_maple",
      brandName: "Maple & Moss",
      step: "waiting_for_brand",
      posts: [{ deliverableId: "del_maple_video", platform: "youtube_video", itemCount: 5, amount: "1200.00", deadlineDays: 14 }],
      link: { url: "https://cleared.example/b/demo_maple", expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(), expired: false },
    }),
  );
};

describe("Mocks: open the link as the brand", () => {
  test("in a mock build, the link panel opens the brand's side in this browser", async () => {
    withLink();
    render(
      <DemoBuildProvider>
        <InvitePage dealId="deal_maple" />
      </DemoBuildProvider>,
    );
    const panel = await screen.findByRole("region", { name: "Send this link to Maple & Moss" });
    expect(within(panel).getByRole("link", { name: "Open as Maple & Moss" })).toHaveAttribute("href", "/b/demo_maple");
  });

  test("outside a mock build there is no such link", async () => {
    withLink();
    render(<InvitePage dealId="deal_maple" />);
    const panel = await screen.findByRole("region", { name: "Send this link to Maple & Moss" });
    expect(within(panel).queryByRole("link", { name: /Open as/ })).toBeNull();
  });
});
