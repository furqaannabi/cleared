import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { CheckStages } from "./check-stages";

test("DC-FR-04: the running check's stages, with the current one marked", () => {
  render(
    <CheckStages
      checking={{
        meta: "Run 3 · started 2 minutes ago · 1 of 2 items done",
        stages: [
          { name: "Reading what’s said", status: "done" },
          { name: "Watching the video", status: "current" },
          { name: "Checking each item", status: "waiting" },
        ],
      }}
    />,
  );
  const panel = screen.getByRole("region", { name: "Checking your draft" });
  expect(panel).toHaveTextContent("Run 3 · started 2 minutes ago · 1 of 2 items done");
  const rows = within(panel).getAllByRole("listitem");
  expect(rows.map((r) => r.textContent)).toEqual(["Reading what’s saidDone", "Watching the videoNow", "Checking each itemNext"]);
  expect(rows[1]).toHaveAttribute("aria-current", "step");
});
