import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { DeliverableSwitcher } from "./deliverable-switcher";

const glow = [
  { id: "del_glow_video", platform: "youtube_video" as const, state: "results" as const },
  { id: "del_glow_reel", platform: "instagram_reel" as const, state: "fully_passing" as const },
];

describe("DC-FR-33 deliverable switcher", () => {
  test("a pill per deliverable naming its platform and step, linking to it; the current one marked", () => {
    render(<DeliverableSwitcher dealId="deal_glow" deliverables={glow} currentId="del_glow_video" />);
    const links = within(screen.getByRole("navigation", { name: "Deliverables in this deal" })).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["YouTube videoDraft check", "Instagram ReelBrand review"]);
    expect(links[1]).toHaveAttribute("href", "/deals/deal_glow/deliverables/del_glow_reel");
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(links[1]).not.toHaveAttribute("aria-current");
  });

  test("a deal with one deliverable has no switcher", () => {
    const { container } = render(<DeliverableSwitcher dealId="deal_nb" deliverables={[glow[0]]} currentId="del_glow_video" />);
    expect(container).toBeEmptyDOMElement();
  });
});
