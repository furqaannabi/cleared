import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import type { ItemView } from "@/lib/deliverable/deliverable-view";
import { BrandNote } from "./brand-note";

const base: ItemView = {
  id: "it_6",
  name: "Serum shown in use",
  kind: "shown",
  status: "unsure",
  briefLine: { number: 6, text: "Show the serum on skin." },
  checkedBy: "ai_timestamp",
  change: null,
  action: null,
  asked: null,
  suggestedFix: null,
};

describe("DC-FR-17 brand note", () => {
  test("a declined item shows the brand's note, as plain text", () => {
    render(<BrandNote item={{ ...base, declined: true, brandNote: "<b>Show it on skin.</b>" }} brandName="Glow Theory" />);
    expect(screen.getByText("Glow Theory asked you to fix this")).toBeVisible();
    expect(screen.getByText("“<b>Show it on skin.</b>”")).toBeVisible();
  });

  test("shows nothing unless the item is Unsure and declined", () => {
    const { container } = render(<BrandNote item={{ ...base, status: "fix_needed", declined: true }} brandName="Glow Theory" />);
    expect(container).toBeEmptyDOMElement();
    const again = render(<BrandNote item={base} brandName="Glow Theory" />);
    expect(again.container).toBeEmptyDOMElement();
  });
});
