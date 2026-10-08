import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { DemoPublishControls } from "@/components/mocking/demo-publish-controls";
import type { Deliverable } from "@/lib/deliverable/types";
import { findDeliverable } from "@/mocks/store";

const captured = (payout: Deliverable["payout"]) => Object.assign(findDeliverable("del_wren_video")!, { state: "captured", payout }) as Deliverable;

describe("PP-FR-32 the payout's demo controls", () => {
  test("the payout can be set to not sent by PayPal", () => {
    render(<DemoPublishControls d={findDeliverable("del_juniper_short")!} onUpdated={() => {}} />);
    expect(screen.getByRole("option", { name: "not sent by PayPal" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try the payout again now" })).toBeNull();
  });

  test("a delayed payout can be tried again now, which sends it", async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    render(<DemoPublishControls d={captured({ state: "delayed", email: "ada@example.com", at: new Date().toISOString(), canSendAgain: false })} onUpdated={onUpdated} />);
    await user.click(screen.getByRole("button", { name: "Try the payout again now" }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ payout: expect.objectContaining({ state: "sending" }) })));
  });
});
