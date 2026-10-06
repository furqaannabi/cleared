import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { Seal } from "./seal";

// Regression: a built-in `relative` overrode callers' `absolute` (Tailwind emits
// `relative` later), dropping the money card's seal into the text.
test("sets no position of its own, so callers can place it", () => {
  const { container } = render(
    <Seal fillClassName="fill-marigold-ink" className="absolute top-4 right-4 size-12">
      <svg />
    </Seal>,
  );
  const classes = container.firstElementChild?.className.split(/\s+/) ?? [];
  expect(classes.filter((c) => ["relative", "absolute", "fixed", "sticky", "static"].includes(c))).toEqual([
    "absolute",
  ]);
});
