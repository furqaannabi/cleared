import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { api } from "@/lib/api";
import { DealsProvider, useDeals, useRefreshDeals } from "./use-deals";

function Probe() {
  const load = useDeals();
  const refresh = useRefreshDeals();
  const glow = load.status === "ready" ? load.deals.find((d) => d.brandName === "Juniper Labs") : undefined;
  return (
    <>
      <p>{glow ? glow.status : "none"}</p>
      <button onClick={refresh}>Refresh</button>
    </>
  );
}

describe("IN-FR-02, BC-FR-17 the deal list refreshes when a deal changes step", () => {
  test("refresh reloads the deals, so the rail shows the new step", async () => {
    render(
      <DealsProvider>
        <Probe />
      </DealsProvider>,
    );
    expect(await screen.findByText("none")).toBeVisible();
    await api.createDeal({ brandName: "Juniper Labs", deliverables: [{ platform: "youtube_video" }] });
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("Checklist")).toBeVisible();
  });
});
