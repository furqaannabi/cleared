import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { api } from "@/lib/api";
import { DraftCheckPage } from "./draft-check-page";

const DEAL = "deal_juniper";
const next = () => screen.getByRole("region", { name: "What happens next" });

describe("DC-FR-49, DC-FR-50 the brand objected", () => {
  test("names how many items and the deadline; the objected item says the check passed it, with the brand's note", async () => {
    await api.openBrandLink("demo_juniper");
    await api.sendObjections(DEAL, "del_juniper_video", [{ itemId: "jv_3", note: "Say it slower." }]);
    render(<DraftCheckPage dealId={DEAL} deliverableId="del_juniper_video" />);
    expect(await within(await screen.findByRole("region", { name: "What happens next" })).findByText(/^Juniper & Salt asked you to fix 1 item\. Upload a new draft by /)).toBeVisible();
    const checklist = screen.getByRole("region", { name: "Checklist" });
    const objected = within(checklist).getByRole("button", { name: /^Say the code TIDE15/ });
    expect(objected).toHaveAttribute("aria-expanded", "true");
    const card = objected.closest("li")!;
    expect(within(card).getAllByText("Juniper & Salt objected")[0]).toBeVisible();
    expect(within(card).getByText("The check passed this. Juniper & Salt asked you to change it:")).toBeVisible();
    expect(within(card).getByText("“Say it slower.”")).toBeVisible();
  });
});

describe("DC-FR-51 approved", () => {
  test("says the brand approved, and not to publish until the hold is confirmed; no upload", async () => {
    render(<DraftCheckPage dealId={DEAL} deliverableId="del_juniper_short" />);
    const banner = await screen.findByRole("region", { name: "Draft approved" });
    expect(banner).toHaveTextContent("Juniper & Salt approved this draft.");
    expect(within(next()).getByText("Don’t publish yet. Cleared confirms Juniper & Salt’s hold with PayPal first.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Upload/ })).toBeNull();
  });
});

describe("DC-FR-52 a link for the brand", () => {
  test("while the brand has something to do, the creator can copy it; never once the brand is done", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DraftCheckPage dealId={DEAL} deliverableId="del_juniper_video" />);
    await user.click(await screen.findByRole("button", { name: "Copy link for Juniper & Salt" }));
    expect(await screen.findByText("Copied")).toBeVisible();
    expect(await navigator.clipboard.readText()).toBe("https://cleared.example/b/review_del_juniper_video");
    unmount();
    render(<DraftCheckPage dealId={DEAL} deliverableId="del_juniper_short" />);
    await screen.findByRole("region", { name: "Draft approved" });
    expect(screen.queryByRole("button", { name: /Copy link/ })).toBeNull();
  });
});
