import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Select } from "./select";

test("a native select with room for its own chevron, keeping label, value and change", async () => {
  render(
    <>
      <label htmlFor="k">Kind</label>
      <Select id="k" defaultValue="said">
        <option value="said">Said</option>
        <option value="shown">Shown</option>
      </Select>
    </>,
  );
  const select = screen.getByLabelText("Kind");
  expect(select.tagName).toBe("SELECT");
  expect(select).toHaveClass("appearance-none");
  expect(select.parentElement?.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  await userEvent.selectOptions(select, "shown");
  expect(select).toHaveValue("shown");
});
