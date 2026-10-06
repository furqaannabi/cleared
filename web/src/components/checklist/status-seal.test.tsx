import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ITEM_STATUSES } from "@/lib/checklist/item-status";
import { StatusSeal } from "./status-seal";

describe("DC-FR-13 StatusSeal", () => {
  test("is decorative, so the chip or the marker label carries the meaning", () => {
    const { container } = render(<StatusSeal status="unsure" />);
    const seal = container.firstElementChild;
    expect(seal).toHaveAttribute("aria-hidden", "true");
  });

  test("every status draws the scalloped seal with its icon inside", () => {
    for (const status of ITEM_STATUSES) {
      const { container, unmount } = render(<StatusSeal status={status} />);
      expect(container.querySelector("[data-seal-shape]"), status).not.toBeNull();
      expect(container.querySelector("[data-seal-icon] svg"), status).not.toBeNull();
      unmount();
    }
  });

  test("only a Passed seal is green", () => {
    for (const status of ITEM_STATUSES) {
      const { container, unmount } = render(<StatusSeal status={status} />);
      const green = container.querySelector(".fill-pass-wash, .text-pass") !== null;
      expect(green, status).toBe(status === "passed");
      unmount();
    }
  });
});
